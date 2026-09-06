const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultState } = require('../src/store');
const { parseCsv, parseImport, mergeImport, serializeExport, toIcs } = require('../src/data-exchange');

test('generic CSV preserves unicode, commas, quotes, projects, and status', () => {
  const source = defaultState();
  source.tasks = [{
    ...source.tasks[0],
    title: '設計, "最終"レビュー',
    detail: '1行目\n2行目',
    priority: 'high',
    status: 'waiting',
    projectId: source.projects[0].id,
    estimatedMinutes: 45
  }];
  const exported = serializeExport('tasksCsv', source);
  assert.ok(exported.content.startsWith('\ufeffName,Description'));
  assert.equal(parseCsv(exported.content)[1][0], '設計, "最終"レビュー');
  const imported = parseImport('missions.csv', exported.content);
  const merged = mergeImport(defaultState(), imported);
  const task = merged.state.tasks.at(-1);
  assert.equal(task.title, '設計, "最終"レビュー');
  assert.equal(task.detail, '1行目\n2行目');
  assert.equal(task.status, 'waiting');
  assert.equal(task.estimatedMinutes, 45);
  assert.equal(merged.state.projects.find((project) => project.id === task.projectId).name, 'Personal Orbit');
});

test('CSV export neutralizes spreadsheet formulas and restores literal text on re-import', () => {
  const source = defaultState();
  source.tasks = [{ ...source.tasks[0], title: '=HYPERLINK("https://invalid.example")', detail: '+1-1' }];
  const exported = serializeExport('tasksCsv', source);
  const rows = parseCsv(exported.content);
  assert.equal(rows[1][0], "'=HYPERLINK(\"https://invalid.example\")");
  assert.equal(rows[1][1], "'+1-1");
  const imported = parseImport('safe.csv', exported.content);
  assert.equal(imported.tasks[0].title, '=HYPERLINK("https://invalid.example")');
  assert.equal(imported.tasks[0].detail, '+1-1');
});

test('Todoist UTF-8 CSV uses official task columns and round-trips active tasks', () => {
  const source = defaultState();
  source.tasks[0].priority = 'high';
  source.tasks[0].estimatedMinutes = 30;
  const exported = serializeExport('todoistCsv', source);
  const rows = parseCsv(exported.content);
  assert.deepEqual(rows[0].slice(0, 5), ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT']);
  assert.ok(rows[0].includes('DURATION_UNIT'));
  assert.equal(rows[1][3], '1');
  const imported = parseImport('todoist-template.csv', exported.content);
  assert.equal(imported.source, 'todoist-csv');
  assert.equal(imported.tasks.length, source.tasks.filter((task) => !task.done).length);
  assert.equal(imported.tasks[0].priority, 'high');
  assert.equal(imported.tasks[0].estimatedMinutes, 30);
});

test('ICS exports timed plans and all-day due missions and imports both safely', () => {
  const source = defaultState();
  source.planItems.push({
    id: 'plan-a', date: '2026-09-05', time: '23:30', duration: 90,
    title: '深夜の設計', taskId: null, done: false, reminderMinutes: -1,
    reminderSentAt: null, autoPlanned: false, createdAt: new Date().toISOString()
  });
  const text = toIcs(source);
  assert.match(text, /^BEGIN:VCALENDAR\r\nVERSION:2\.0/);
  assert.match(text, /DTEND:20260906T010000/);
  assert.match(text, /DTSTART;VALUE=DATE:/);
  const imported = parseImport('calendar.ics', text);
  assert.equal(imported.planItems.length, 1);
  assert.equal(imported.planItems[0].duration, 90);
  assert.equal(imported.tasks.length, 2);
});

test('Google Calendar CSV maps date, AM/PM time, and duration to a time block', () => {
  const csv = '\ufeffSubject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Private\r\nDesign Review,09/05/2026,1:15 PM,09/05/2026,2:00 PM,False,Review,True\r\n';
  const imported = parseImport('google-calendar.csv', csv);
  assert.equal(imported.source, 'calendar-csv');
  assert.deepEqual(imported.planItems.map(({ date, time, duration }) => ({ date, time, duration })), [{ date: '2026-09-05', time: '13:15', duration: 45 }]);
});

test('Markdown import appends to the local logbook without overwriting it', () => {
  const source = defaultState();
  const imported = parseImport('Notion Export.md', '# Imported knowledge');
  const merged = mergeImport(source, imported);
  assert.match(merged.state.notes, /Captain's Log/);
  assert.match(merged.state.notes, /---\n\n# Imported knowledge$/);
  assert.equal(merged.counts.notes, 1);
});

test('Trello JSON maps boards, list states, and checklist items', () => {
  const trello = {
    name: 'Launch Board',
    lists: [{ id: 'todo', name: 'Backlog' }, { id: 'done', name: 'Done' }],
    cards: [{
      id: 'card-a', name: 'Ship it', desc: 'Release candidate', idList: 'done', closed: false,
      due: '2026-09-08T12:00:00.000Z',
      checklists: [{ checkItems: [{ name: 'Sign build', state: 'complete' }] }]
    }]
  };
  const imported = parseImport('trello-export.json', JSON.stringify(trello));
  const merged = mergeImport(defaultState(), imported);
  const task = merged.state.tasks.at(-1);
  assert.equal(task.title, 'Ship it');
  assert.equal(task.status, 'done');
  assert.equal(task.subtasks[0].done, true);
  assert.equal(merged.state.projects.find((project) => project.id === task.projectId).name, 'Launch Board');
});

test('ASTERIA JSON backup restores the complete normalized state', () => {
  const source = defaultState();
  source.notes = 'backup payload';
  source.settings.appearance = 'light';
  source.settings.accentColor = '#e91e63';
  const backup = serializeExport('backup', source);
  const imported = parseImport('ASTERIA-backup.json', backup.content);
  const restored = mergeImport(defaultState(), imported).state;
  assert.equal(restored.version, 7);
  assert.equal(restored.notes, 'backup payload');
  assert.equal(restored.settings.appearance, 'light');
  assert.equal(restored.settings.accentColor, '#e91e63');
});
