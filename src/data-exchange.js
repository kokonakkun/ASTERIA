const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { normalizeState } = require('./store');

const EXPORT_FORMATS = {
  backup: { label: 'ASTERIA完全バックアップ', extension: 'json' },
  tasksCsv: { label: '汎用タスクCSV', extension: 'csv' },
  todoistCsv: { label: 'TodoistプロジェクトCSV', extension: 'csv' },
  calendarIcs: { label: 'カレンダー（ICS）', extension: 'ics' },
  calendarCsv: { label: 'Google Calendar CSV', extension: 'csv' },
  notesMarkdown: { label: 'ログブック（Markdown）', extension: 'md' }
};

const csvCell = (value) => {
  const raw = String(value ?? '').replace(/\r?\n/g, '\n');
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function toCsv(rows) {
  return `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\ufeff/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.trim()));
}

const normalizeHeader = (value) => String(value || '').trim().toLowerCase().replace(/[ _-]+/g, '');

function rowsAsObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

const getField = (row, ...names) => {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value !== undefined && String(value).trim() !== '') {
      const text = String(value).trim();
      return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
    }
  }
  return '';
};

function dateKey(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return '';
}

function time24(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3]) {
    if (hour === 12) hour = 0;
    if (match[3].toUpperCase() === 'PM') hour += 12;
  }
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function priorityFrom(value, todoist = false) {
  const text = String(value || '').toLowerCase();
  if (todoist) return text === '1' ? 'high' : ['2', '3'].includes(text) ? 'medium' : 'low';
  if (['high', 'p1', 'urgent', 'highest', '高'].some((token) => text.includes(token))) return 'high';
  if (['low', 'p4', 'lowest', '低'].some((token) => text.includes(token))) return 'low';
  return 'medium';
}

function statusFrom(value, done = false) {
  if (done) return 'done';
  const text = String(value || '').toLowerCase();
  if (/done|complete|completed|完了/.test(text)) return 'done';
  if (/wait|blocked|保留|待機/.test(text)) return 'waiting';
  if (/backlog|todo|later|あとで/.test(text)) return 'backlog';
  return 'next';
}

const boolValue = (value) => /^(1|true|yes|done|completed|完了)$/i.test(String(value || '').trim());
const newId = (prefix) => `${prefix}-${randomUUID()}`;

function taskFromRow(row, source) {
  const todoist = source === 'todoist';
  const title = getField(row, todoist ? 'CONTENT' : 'Name', 'Title', 'Task', 'Card Name', 'Subject', 'CONTENT');
  if (!title) return null;
  const completed = boolValue(getField(row, 'Completed', 'Done', 'Closed'));
  const status = statusFrom(getField(row, 'Status', 'List Name', 'Section'), completed);
  const duration = Number(getField(row, 'Estimated Minutes', 'Duration', 'DURATION')) || 25;
  return {
    id: newId('import-task'),
    title: title.slice(0, 100),
    detail: getField(row, 'Description', 'Detail', 'Notes', 'DESCRIPTION').slice(0, 500),
    priority: priorityFrom(getField(row, 'Priority', 'PRIORITY'), todoist),
    category: (getField(row, 'Category') || 'WORK').toUpperCase().slice(0, 20),
    due: dateKey(getField(row, 'Due', 'Due Date', 'Deadline', 'DEADLINE', 'DATE')) || null,
    done: status === 'done',
    status,
    projectId: null,
    projectName: getField(row, 'Project', 'Board Name'),
    recurrence: 'none',
    seriesId: null,
    estimatedMinutes: Math.min(240, Math.max(5, Math.round(duration / 5) * 5)),
    subtasks: [],
    createdAt: new Date().toISOString(),
    completedAt: status === 'done' ? new Date().toISOString() : null
  };
}

function parseCsvImport(text) {
  const rows = rowsAsObjects(text).slice(0, 5000);
  if (!rows.length) throw new Error('CSVに読み込める行がありません。');
  const first = rows[0];
  const isTodoist = 'type' in first && 'content' in first;
  const isCalendar = 'subject' in first && ('startdate' in first || 'starttime' in first);
  if (isCalendar) {
    const planItems = rows.slice(0, 1000).map((row) => {
      const title = getField(row, 'Subject');
      const date = dateKey(getField(row, 'Start Date'));
      if (!title || !date) return null;
      const start = time24(getField(row, 'Start Time')) || '09:00';
      const end = time24(getField(row, 'End Time'));
      const [startHour, startMinute] = start.split(':').map(Number);
      const [endHour, endMinute] = (end || start).split(':').map(Number);
      const duration = end ? Math.max(5, endHour * 60 + endMinute - startHour * 60 - startMinute) : 30;
      return { id: newId('import-plan'), date, time: start, duration, title: title.slice(0, 100), taskId: null, done: false, reminderMinutes: -1, reminderSentAt: null, autoPlanned: false, createdAt: new Date().toISOString() };
    }).filter(Boolean);
    return { kind: 'merge', source: 'calendar-csv', tasks: [], planItems, notes: '' };
  }
  const tasks = rows.filter((row) => !isTodoist || getField(row, 'TYPE').toLowerCase() === 'task')
    .map((row) => taskFromRow(row, isTodoist ? 'todoist' : 'generic')).filter(Boolean);
  if (!tasks.length) throw new Error('CSVにミッションとして読み込める行がありません。');
  return { kind: 'merge', source: isTodoist ? 'todoist-csv' : 'tasks-csv', tasks, planItems: [], notes: '' };
}

const icsEscape = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsUnescape = (value) => String(value ?? '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const compactDate = (value) => String(value || '').replace(/-/g, '');

function addDays(value, amount) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMinutes(date, time, amount) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute + amount);
  return {
    date: `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`,
    time: `${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}`
  };
}

const icsDateTime = (date, time) => `${compactDate(date)}T${String(time).replace(':', '')}00`;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function toIcs(state) {
  const events = [];
  for (const item of state.planItems || []) {
    const end = addMinutes(item.date, item.time, Number(item.duration || 30));
    events.push([
      'BEGIN:VEVENT',
      `UID:${icsEscape(item.id)}@asteria.local`,
      `DTSTAMP:${stamp()}`,
      `DTSTART:${icsDateTime(item.date, item.time)}`,
      `DTEND:${icsDateTime(end.date, end.time)}`,
      `SUMMARY:${icsEscape(item.title)}`,
      `DESCRIPTION:${icsEscape('ASTERIAの時間ブロック')}`,
      `STATUS:${item.done ? 'COMPLETED' : 'CONFIRMED'}`,
      'X-ASTERIA-TYPE:PLAN',
      'END:VEVENT'
    ].join('\r\n'));
  }
  for (const task of (state.tasks || []).filter((item) => item.due && !state.planItems?.some((plan) => plan.taskId === item.id))) {
    events.push([
      'BEGIN:VEVENT',
      `UID:${icsEscape(task.id)}@asteria.local`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${compactDate(task.due)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(task.due, 1))}`,
      `SUMMARY:${icsEscape(task.title)}`,
      `DESCRIPTION:${icsEscape(task.detail || 'ASTERIAのミッション')}`,
      `STATUS:${task.done ? 'COMPLETED' : 'CONFIRMED'}`,
      'X-ASTERIA-TYPE:TASK',
      'END:VEVENT'
    ].join('\r\n'));
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ASTERIA Studio//ASTERIA 4.0//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

function readIcsField(block, name) {
  const line = block.split('\n').find((item) => new RegExp(`^${name}(?:;[^:]*)?:`, 'i').test(item.trim()));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function parseIcsValue(value) {
  const text = String(value || '').trim();
  if (/^\d{8}$/.test(text)) return { date: `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`, time: '', allDay: true, epoch: null };
  const match = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  if (match[7]) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)));
    return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`, allDay: false, epoch: date.getTime() };
  }
  const epoch = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)).getTime();
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}`, allDay: false, epoch };
}

function parseIcs(text) {
  const unfolded = String(text || '').replace(/\r?\n[ \t]/g, '').replace(/\r/g, '');
  if (!/BEGIN:VCALENDAR/i.test(unfolded)) throw new Error('有効なICSカレンダーではありません。');
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) || [];
  const tasks = [];
  const planItems = [];
  for (const block of blocks.slice(0, 2000)) {
    const start = parseIcsValue(readIcsField(block, 'DTSTART'));
    const end = parseIcsValue(readIcsField(block, 'DTEND'));
    const title = icsUnescape(readIcsField(block, 'SUMMARY')) || '読み込んだ予定';
    const detail = icsUnescape(readIcsField(block, 'DESCRIPTION'));
    if (!start) continue;
    if (start.allDay) {
      tasks.push({ id: newId('import-task'), title: title.slice(0, 100), detail: detail.slice(0, 500), priority: 'medium', category: 'WORK', due: start.date, done: false, status: 'next', projectId: null, recurrence: 'none', seriesId: null, estimatedMinutes: 25, subtasks: [], createdAt: new Date().toISOString(), completedAt: null });
    } else {
      const duration = end?.epoch && start.epoch ? Math.max(5, Math.round((end.epoch - start.epoch) / 60000)) : 30;
      planItems.push({ id: newId('import-plan'), date: start.date, time: start.time, duration: Math.min(480, duration), title: title.slice(0, 100), taskId: null, done: false, reminderMinutes: -1, reminderSentAt: null, autoPlanned: false, createdAt: new Date().toISOString() });
    }
  }
  if (!tasks.length && !planItems.length) throw new Error('ICSに読み込めるイベントがありません。');
  return { kind: 'merge', source: 'calendar-ics', tasks, planItems, notes: '' };
}

function parseTrello(input) {
  const cards = Array.isArray(input.cards) ? input.cards : [];
  if (!cards.length) throw new Error('Trelloカードを見つけられませんでした。');
  const lists = new Map((input.lists || []).map((list) => [list.id, list.name]));
  const projectName = String(input.name || 'Trello Import').slice(0, 80);
  const tasks = cards.filter((card) => !card.closed).slice(0, 5000).map((card) => {
    const checklistItems = (card.checklists || []).flatMap((list) => list.checkItems || []);
    const status = statusFrom(lists.get(card.idList) || '', false);
    return {
      id: newId('trello-card'), title: String(card.name || 'Trello card').slice(0, 100), detail: String(card.desc || '').slice(0, 500),
      priority: 'medium', category: 'WORK', due: dateKey(card.due) || null, done: status === 'done', status, projectId: null, projectName,
      recurrence: 'none', seriesId: null, estimatedMinutes: 25,
      subtasks: checklistItems.slice(0, 50).map((item) => ({ id: newId('trello-check'), title: String(item.name || 'Checklist').slice(0, 120), done: item.state === 'complete' })),
      createdAt: card.dateLastActivity || new Date().toISOString(), completedAt: null
    };
  });
  return { kind: 'merge', source: 'trello-json', tasks, planItems: [], notes: '' };
}

function toTasksCsv(state) {
  const projectNames = new Map((state.projects || []).map((project) => [project.id, project.name]));
  const rows = [['Name', 'Description', 'Priority', 'Status', 'Due', 'Project', 'Category', 'Estimated Minutes', 'Completed', 'Recurrence']];
  for (const task of state.tasks || []) rows.push([task.title, task.detail, task.priority, task.status, task.due || '', projectNames.get(task.projectId) || '', task.category, task.estimatedMinutes, task.done, task.recurrence]);
  return toCsv(rows);
}

function toTodoistCsv(state) {
  const rows = [['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'AUTHOR', 'RESPONSIBLE', 'DATE', 'DATE_LANG', 'TIMEZONE', 'DURATION', 'DURATION_UNIT', 'DEADLINE', 'DEADLINE_LANG']];
  const priority = { high: 1, medium: 2, low: 4 };
  for (const task of (state.tasks || []).filter((item) => !item.done)) rows.push(['task', task.title, task.detail, priority[task.priority] || 2, 1, '', '', task.due || '', 'ja', '', task.estimatedMinutes || 25, 'minute', task.due || '', 'ja']);
  return toCsv(rows);
}

function toCalendarCsv(state) {
  const rows = [['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day Event', 'Description', 'Private']];
  const formatDate = (value) => { const [year, month, day] = value.split('-'); return `${month}/${day}/${year}`; };
  const formatTime = (value) => { let [hour, minute] = value.split(':').map(Number); const suffix = hour >= 12 ? 'PM' : 'AM'; hour %= 12; if (!hour) hour = 12; return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`; };
  for (const item of state.planItems || []) {
    const end = addMinutes(item.date, item.time, Number(item.duration || 30));
    rows.push([item.title, formatDate(item.date), formatTime(item.time), formatDate(end.date), formatTime(end.time), 'False', 'ASTERIAの時間ブロック', 'True']);
  }
  return toCsv(rows);
}

function serializeExport(format, state) {
  const today = new Date().toISOString().slice(0, 10);
  if (!EXPORT_FORMATS[format]) throw new Error('未対応の書き出し形式です。');
  if (format === 'backup') return { content: JSON.stringify(normalizeState(state), null, 2), defaultName: `ASTERIA-3-backup-${today}.json`, count: (state.tasks || []).length + (state.planItems || []).length };
  if (format === 'tasksCsv') return { content: toTasksCsv(state), defaultName: `ASTERIA-missions-${today}.csv`, count: (state.tasks || []).length };
  if (format === 'todoistCsv') return { content: toTodoistCsv(state), defaultName: `ASTERIA-for-Todoist-${today}.csv`, count: (state.tasks || []).filter((item) => !item.done).length };
  if (format === 'calendarIcs') return { content: toIcs(state), defaultName: `ASTERIA-calendar-${today}.ics`, count: (state.planItems || []).length + (state.tasks || []).filter((item) => item.due).length };
  if (format === 'calendarCsv') return { content: toCalendarCsv(state), defaultName: `ASTERIA-for-Google-Calendar-${today}.csv`, count: (state.planItems || []).length };
  return { content: String(state.notes || ''), defaultName: `ASTERIA-logbook-${today}.md`, count: String(state.notes || '').length };
}

function parseImport(filePath, content) {
  const extension = path.extname(filePath || '').toLowerCase();
  if (extension === '.ics') return parseIcs(content);
  if (extension === '.csv') return parseCsvImport(content);
  if (['.md', '.markdown', '.txt'].includes(extension)) return { kind: 'merge', source: 'markdown', tasks: [], planItems: [], notes: String(content || '').slice(0, 200000) };
  if (extension === '.json') {
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new Error('JSONの形式が正しくありません。'); }
    if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.focusSessions)) return { kind: 'full', source: 'asteria-backup', state: parsed };
    return parseTrello(parsed || {});
  }
  throw new Error('対応していないファイル形式です。');
}

function mergeImport(current, imported) {
  if (imported.kind === 'full') return { state: normalizeState(imported.state), counts: { tasks: imported.state.tasks?.length || 0, planItems: imported.state.planItems?.length || 0, notes: imported.state.notes ? 1 : 0 } };
  const next = JSON.parse(JSON.stringify(current));
  next.projects = Array.isArray(next.projects) ? next.projects : [];
  next.tasks = Array.isArray(next.tasks) ? next.tasks : [];
  next.planItems = Array.isArray(next.planItems) ? next.planItems : [];
  const projectByName = new Map(next.projects.map((project) => [project.name.toLowerCase(), project]));
  const palette = ['violet', 'cyan', 'amber', 'green'];
  const importedTasks = (imported.tasks || []).map((task) => {
    if (task.projectName) {
      const key = task.projectName.toLowerCase();
      if (!projectByName.has(key) && next.projects.length < 50) {
        const project = { id: newId('import-project'), name: task.projectName.slice(0, 80), description: `Imported from ${imported.source}`, color: palette[next.projects.length % palette.length], archived: false, createdAt: new Date().toISOString() };
        next.projects.push(project); projectByName.set(key, project);
      }
      task.projectId = projectByName.get(key)?.id || null;
      delete task.projectName;
    }
    return task;
  });
  next.tasks.push(...importedTasks);
  next.planItems.push(...(imported.planItems || []));
  if (imported.notes) next.notes = `${next.notes ? `${next.notes}\n\n---\n\n` : ''}${imported.notes}`.slice(0, 200000);
  return { state: normalizeState(next), counts: { tasks: importedTasks.length, planItems: (imported.planItems || []).length, notes: imported.notes ? 1 : 0 } };
}

module.exports = { EXPORT_FORMATS, parseCsv, parseImport, mergeImport, serializeExport, toIcs };
