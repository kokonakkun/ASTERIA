(function exposeAsteriaEngine(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AsteriaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const allowedConditions = ['overdue_open', 'due_today_open', 'no_due_open', 'high_priority_open', 'waiting_stale', 'completed_today'];
  const allowedActions = ['priority_high', 'move_next', 'set_due_today', 'assign_inbox', 'append_log', 'schedule_today'];

  const pad = (number) => String(number).padStart(2, '0');
  const dateKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const addDays = (key, amount) => {
    const [year, month, day] = String(key).split('-').map(Number);
    return dateKey(new Date(year, month - 1, day + Number(amount || 0)));
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fallbackId = (prefix = 'item') => {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
  const minutes = (time) => {
    const match = String(time || '').match(/^(\d{2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  };
  const timeFromMinutes = (value) => `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;

  function defaultAutomationRules() {
    return [
      {
        id: 'auto-overdue-priority', name: '期限切れを最優先へ', description: '期限を過ぎた未完了ミッションをHIGHへ引き上げます。',
        condition: 'overdue_open', action: 'priority_high', enabled: false, builtin: true, runCount: 0, lastRunAt: null, processedIds: []
      },
      {
        id: 'auto-today-priority', name: '今日の締切を見逃さない', description: '今日が期限のミッションをHIGHへ引き上げます。',
        condition: 'due_today_open', action: 'priority_high', enabled: false, builtin: true, runCount: 0, lastRunAt: null, processedIds: []
      },
      {
        id: 'auto-today-next', name: '今日の仕事をNEXTへ', description: '今日が期限の待機・バックログをNEXTへ移します。',
        condition: 'due_today_open', action: 'move_next', enabled: false, builtin: true, runCount: 0, lastRunAt: null, processedIds: []
      },
      {
        id: 'auto-unscheduled-block', name: '高優先度を時間にする', description: '未配置のHIGHミッションを今日の空き時間へ配置します。',
        condition: 'high_priority_open', action: 'schedule_today', enabled: false, builtin: true, runCount: 0, lastRunAt: null, processedIds: []
      },
      {
        id: 'auto-completed-log', name: '完了をログへ記録', description: '今日完了したミッションをログブックへ一度だけ追記します。',
        condition: 'completed_today', action: 'append_log', enabled: false, builtin: true, runCount: 0, lastRunAt: null, processedIds: []
      }
    ];
  }

  function defaultTemplates() {
    return [
      {
        id: 'template-deep-work', name: 'Deep Work Sprint', icon: '◷', color: 'violet', builtin: true,
        description: '準備からレビューまで、集中作業を2日で前進させる軌道。',
        tasks: [
          { title: '成果物の完了条件を1文で定義する', detail: '終わりが見える状態を先に決める。', priority: 'high', category: 'FOCUS', dueOffset: 0, estimatedMinutes: 25 },
          { title: '通知を切り、90分の集中ブロックを実行する', detail: 'ひとつの成果物だけを開く。', priority: 'high', category: 'FOCUS', dueOffset: 0, estimatedMinutes: 90 },
          { title: '成果をレビューして次の一手を記録する', detail: '改善点を3つ以内に絞る。', priority: 'medium', category: 'GROWTH', dueOffset: 1, estimatedMinutes: 30 }
        ],
        plans: [{ title: 'Deep Work Sprint', dayOffset: 0, time: '09:30', duration: 90, taskIndex: 1 }]
      },
      {
        id: 'template-weekly-reset', name: 'Weekly Reset', icon: '↻', color: 'cyan', builtin: true,
        description: '未完了を整理し、次の一週間を静かに設計します。',
        tasks: [
          { title: '未完了ミッションを棚卸しする', priority: 'high', category: 'WORK', dueOffset: 0, estimatedMinutes: 25 },
          { title: '来週の最重要成果を3つ決める', priority: 'high', category: 'FOCUS', dueOffset: 0, estimatedMinutes: 25 },
          { title: 'カレンダーへ集中時間を確保する', priority: 'medium', category: 'WORK', dueOffset: 1, estimatedMinutes: 20 },
          { title: 'ログブックへ週の学びを残す', priority: 'low', category: 'GROWTH', dueOffset: 1, estimatedMinutes: 15 }
        ],
        plans: [{ title: 'Weekly Reset', dayOffset: 0, time: '17:00', duration: 45, taskIndex: 0 }]
      },
      {
        id: 'template-launch', name: 'Launch Sequence', icon: '△', color: 'amber', builtin: true,
        description: '企画、制作、確認、公開後レビューを一つのプロジェクトへ展開。',
        tasks: [
          { title: '目的・対象・成功指標を確定する', priority: 'high', category: 'WORK', dueOffset: 0, estimatedMinutes: 45 },
          { title: '公開チェックリストを作成する', priority: 'high', category: 'WORK', dueOffset: 1, estimatedMinutes: 30 },
          { title: '最終成果物をレビューする', priority: 'high', category: 'FOCUS', dueOffset: 3, estimatedMinutes: 60 },
          { title: '公開して関係者へ共有する', priority: 'medium', category: 'WORK', dueOffset: 4, estimatedMinutes: 25 },
          { title: '24時間後の結果を振り返る', priority: 'medium', category: 'GROWTH', dueOffset: 5, estimatedMinutes: 30 }
        ],
        plans: []
      },
      {
        id: 'template-learning', name: 'Learning Loop', icon: '◇', color: 'green', builtin: true,
        description: '学ぶ、試す、説明するの小さな反復で知識を定着。',
        tasks: [
          { title: '学びたい問いをひとつ決める', priority: 'high', category: 'GROWTH', dueOffset: 0, estimatedMinutes: 15 },
          { title: '資料を読み、要点を5行でまとめる', priority: 'medium', category: 'GROWTH', dueOffset: 0, estimatedMinutes: 45 },
          { title: '小さな実験で知識を試す', priority: 'high', category: 'FOCUS', dueOffset: 1, estimatedMinutes: 60 },
          { title: '自分の言葉で説明をログに残す', priority: 'medium', category: 'GROWTH', dueOffset: 1, estimatedMinutes: 25 }
        ],
        plans: [{ title: 'Learning Lab', dayOffset: 1, time: '19:00', duration: 60, taskIndex: 2 }]
      }
    ];
  }

  function normalizeRule(rule, index = 0) {
    const condition = allowedConditions.includes(rule?.condition) ? rule.condition : 'overdue_open';
    const action = allowedActions.includes(rule?.action) ? rule.action : 'priority_high';
    return {
      id: String(rule?.id || `automation-${index}-${Date.now()}`).slice(0, 100),
      name: String(rule?.name || '新しい自動化').slice(0, 80),
      description: String(rule?.description || '').slice(0, 240),
      condition,
      action,
      enabled: Boolean(rule?.enabled),
      builtin: Boolean(rule?.builtin),
      runCount: Math.max(0, Number(rule?.runCount) || 0),
      lastRunAt: rule?.lastRunAt || null,
      processedIds: Array.isArray(rule?.processedIds) ? [...new Set(rule.processedIds.map(String))].slice(-500) : []
    };
  }

  function normalizeTemplate(template, index = 0) {
    return {
      id: String(template?.id || `template-${index}-${Date.now()}`).slice(0, 100),
      name: String(template?.name || '名称未設定テンプレート').slice(0, 80),
      icon: String(template?.icon || '✦').slice(0, 4),
      color: ['violet', 'cyan', 'amber', 'green'].includes(template?.color) ? template.color : 'violet',
      builtin: Boolean(template?.builtin),
      description: String(template?.description || '').slice(0, 240),
      tasks: Array.isArray(template?.tasks) ? template.tasks.slice(0, 40).map((task) => ({
        title: String(task?.title || '新しいミッション').slice(0, 100),
        detail: String(task?.detail || '').slice(0, 500),
        priority: ['high', 'medium', 'low'].includes(task?.priority) ? task.priority : 'medium',
        category: String(task?.category || 'WORK').toUpperCase().slice(0, 20),
        dueOffset: task?.dueOffset === null ? null : Math.min(365, Math.max(0, Number(task?.dueOffset) || 0)),
        estimatedMinutes: Math.min(240, Math.max(5, Math.round((Number(task?.estimatedMinutes) || 25) / 5) * 5))
      })) : [],
      plans: Array.isArray(template?.plans) ? template.plans.slice(0, 20).map((plan) => ({
        title: String(plan?.title || '集中ブロック').slice(0, 100),
        dayOffset: Math.min(365, Math.max(0, Number(plan?.dayOffset) || 0)),
        time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(plan?.time)) ? String(plan.time) : '09:00',
        duration: Math.min(480, Math.max(5, Number(plan?.duration) || 30)),
        taskIndex: Number.isInteger(Number(plan?.taskIndex)) ? Number(plan.taskIndex) : null
      })) : []
    };
  }

  function taskMatches(task, condition, today, now) {
    if (!task) return false;
    if (condition === 'overdue_open') return !task.done && Boolean(task.due) && task.due < today;
    if (condition === 'due_today_open') return !task.done && task.due === today;
    if (condition === 'no_due_open') return !task.done && !task.due;
    if (condition === 'high_priority_open') return !task.done && task.priority === 'high';
    if (condition === 'completed_today') return task.done && Boolean(task.completedAt) && dateKey(task.completedAt) === today;
    if (condition === 'waiting_stale') {
      const created = new Date(task.createdAt || 0).getTime();
      return !task.done && task.status === 'waiting' && created > 0 && now.getTime() - created >= 14 * 86400000;
    }
    return false;
  }

  function findOpenSlot(planItems, today, duration, now) {
    const occupied = (planItems || []).filter((item) => item.date === today && !item.done)
      .map((item) => [minutes(item.time), minutes(item.time) + Number(item.duration || 30)])
      .sort((a, b) => a[0] - b[0]);
    const sameDay = dateKey(now) === today;
    let cursor = sameDay ? Math.max(9 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15) : 9 * 60;
    const safeDuration = Math.min(120, Math.max(15, Number(duration) || 25));
    for (const [start, end] of occupied) {
      if (cursor + safeDuration <= start) return timeFromMinutes(cursor);
      if (cursor < end) cursor = Math.ceil(end / 15) * 15;
    }
    return cursor + safeDuration <= 22 * 60 ? timeFromMinutes(cursor) : null;
  }

  function runAutomationRules(input, options = {}) {
    const state = clone(input || {});
    state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
    state.projects = Array.isArray(state.projects) ? state.projects : [];
    state.planItems = Array.isArray(state.planItems) ? state.planItems : [];
    state.automations = state.automations || { rules: [], history: [] };
    state.automations.rules = Array.isArray(state.automations.rules) ? state.automations.rules.map(normalizeRule) : [];
    state.automations.history = Array.isArray(state.automations.history) ? state.automations.history : [];
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const today = dateKey(now);
    const idFactory = options.idFactory || fallbackId;
    const selectedIds = Array.isArray(options.ruleIds) ? new Set(options.ruleIds) : null;
    const selected = state.automations.rules.filter((rule) => selectedIds ? selectedIds.has(rule.id) : rule.enabled);
    const changes = [];

    for (const rule of selected) {
      const matches = state.tasks.filter((task) => taskMatches(task, rule.condition, today, now));
      let ruleChanges = 0;
      if (rule.action === 'append_log') {
        const fresh = matches.filter((task) => !rule.processedIds.includes(task.id));
        if (fresh.length) {
          const lines = fresh.map((task) => `- [x] ${task.title}`);
          state.notes = `${String(state.notes || '').trimEnd()}\n\n## ${today} · AUTO LOG\n${lines.join('\n')}`.slice(0, 200000);
          rule.processedIds = [...rule.processedIds, ...fresh.map((task) => task.id)].slice(-500);
          ruleChanges = fresh.length;
          changes.push({ ruleId: rule.id, action: rule.action, count: fresh.length, entityIds: fresh.map((task) => task.id) });
        }
      } else {
        let inbox = null;
        if (rule.action === 'assign_inbox') {
          inbox = state.projects.find((project) => project.name.toLowerCase() === 'automation inbox');
          if (!inbox && matches.some((task) => !task.projectId)) {
            inbox = { id: idFactory('automation-project'), name: 'Automation Inbox', description: 'NEXUSが整理した未分類ミッション。', color: 'cyan', archived: false, createdAt: now.toISOString() };
            state.projects.push(inbox);
          }
        }
        for (const task of matches) {
          let changed = false;
          if (rule.action === 'priority_high' && task.priority !== 'high') { task.priority = 'high'; changed = true; }
          if (rule.action === 'move_next' && !task.done && task.status !== 'next') { task.status = 'next'; changed = true; }
          if (rule.action === 'set_due_today' && !task.due) { task.due = today; changed = true; }
          if (rule.action === 'assign_inbox' && !task.projectId && inbox) { task.projectId = inbox.id; changed = true; }
          if (rule.action === 'schedule_today' && !state.planItems.some((item) => item.taskId === task.id && item.date === today)) {
            const slot = findOpenSlot(state.planItems, today, task.estimatedMinutes, now);
            if (slot) {
              state.planItems.push({ id: idFactory('automation-plan'), date: today, time: slot, duration: Math.min(120, Number(task.estimatedMinutes || 25)), title: task.title, taskId: task.id, done: false, reminderMinutes: -1, reminderSentAt: null, autoPlanned: true, createdAt: now.toISOString() });
              changed = true;
            }
          }
          if (changed) {
            ruleChanges += 1;
            changes.push({ ruleId: rule.id, action: rule.action, count: 1, entityIds: [task.id] });
          }
        }
      }
      rule.runCount += 1;
      rule.lastRunAt = now.toISOString();
      state.automations.history.unshift({
        id: idFactory('automation-run'), ruleId: rule.id, ruleName: rule.name, action: rule.action,
        count: ruleChanges, at: now.toISOString()
      });
    }
    state.automations.history = state.automations.history.slice(0, 100);
    state.automations.lastRunAt = now.toISOString();
    return { state, changes, rulesRun: selected.length, changeCount: changes.reduce((sum, item) => sum + item.count, 0) };
  }

  function uniqueProjectName(projects, baseName) {
    const names = new Set((projects || []).map((project) => String(project.name).toLowerCase()));
    if (!names.has(baseName.toLowerCase())) return baseName;
    let index = 2;
    while (names.has(`${baseName} ${index}`.toLowerCase())) index += 1;
    return `${baseName} ${index}`;
  }

  function instantiateTemplate(input, rawTemplate, options = {}) {
    const state = clone(input || {});
    state.projects = Array.isArray(state.projects) ? state.projects : [];
    state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
    state.planItems = Array.isArray(state.planItems) ? state.planItems : [];
    const template = normalizeTemplate(rawTemplate);
    if (!template.tasks.length) throw new Error('テンプレートにミッションがありません。');
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const today = dateKey(now);
    const idFactory = options.idFactory || fallbackId;
    const project = {
      id: idFactory('template-project'), name: uniqueProjectName(state.projects, template.name),
      description: template.description, color: template.color, archived: false, createdAt: now.toISOString()
    };
    state.projects.push(project);
    const tasks = template.tasks.map((item) => ({
      id: idFactory('template-task'), title: item.title, detail: item.detail || '', priority: item.priority,
      category: item.category, due: item.dueOffset === null ? null : addDays(today, item.dueOffset),
      done: false, status: 'next', projectId: project.id, recurrence: 'none', seriesId: null,
      estimatedMinutes: item.estimatedMinutes, subtasks: [], createdAt: now.toISOString(), completedAt: null
    }));
    state.tasks.push(...tasks);
    const plans = template.plans.map((item) => ({
      id: idFactory('template-plan'), date: addDays(today, item.dayOffset), time: item.time, duration: item.duration,
      title: item.title, taskId: tasks[item.taskIndex]?.id || null, done: false, reminderMinutes: -1,
      reminderSentAt: null, autoPlanned: false, createdAt: now.toISOString()
    }));
    state.planItems.push(...plans);
    return { state, created: { projectId: project.id, taskIds: tasks.map((task) => task.id), planIds: plans.map((plan) => plan.id) } };
  }

  function normalizeSearchText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/\s+/g, ' ').trim();
  }

  function searchScore(haystack, query, tokens) {
    const text = normalizeSearchText(haystack);
    if (!query) return 1;
    if (!tokens.every((token) => text.includes(token))) return 0;
    let score = tokens.reduce((sum, token) => sum + (text.startsWith(token) ? 35 : 12), 0);
    if (text === query) score += 100;
    else if (text.startsWith(query)) score += 45;
    else if (text.includes(query)) score += 25;
    return score;
  }

  function searchWorkspace(state, rawQuery, options = {}) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];
    const tokens = query.split(' ').filter(Boolean);
    const results = [];
    const push = (type, id, title, subtitle, haystack, data = {}) => {
      const score = searchScore(`${title} ${subtitle} ${haystack}`, query, tokens);
      if (score) results.push({ type, id, title, subtitle, score, ...data });
    };
    const projectNames = new Map((state.projects || []).map((project) => [project.id, project.name]));
    for (const task of state.tasks || []) push('task', task.id, task.title, `${task.done ? '完了' : 'ミッション'} · ${projectNames.get(task.projectId) || '未分類'}`, `${task.detail} ${task.category} ${task.priority} ${task.due || ''}`, { entity: task });
    for (const project of state.projects || []) push('project', project.id, project.name, 'プロジェクト', project.description, { entity: project });
    for (const plan of state.planItems || []) push('plan', plan.id, plan.title, `予定 · ${plan.date} ${plan.time}`, `${plan.duration}分`, { entity: plan });
    for (const habit of state.habits || []) push('habit', habit.id, habit.name, `習慣 · 週${habit.target}日`, '', { entity: habit });
    const noteLines = String(state.notes || '').split(/\r?\n/);
    let currentHeading = 'ログブック';
    noteLines.forEach((line, index) => {
      if (/^#{1,3}\s+/.test(line)) currentHeading = line.replace(/^#{1,3}\s+/, '').trim() || 'ログブック';
      const content = line.replace(/^[-*>#\s]+/, '').trim();
      if (content) push('note', `note-${index}`, currentHeading, `ログブック · ${index + 1}行目`, content, { line: index + 1 });
    });
    for (const rule of state.automations?.rules || []) push('automation', rule.id, rule.name, 'NEXUS自動化', `${rule.description} ${rule.condition} ${rule.action}`, { entity: rule });
    for (const template of state.templates || []) push('template', template.id, template.name, 'NEXUSテンプレート', template.description, { entity: template });
    const typeOrder = { task: 0, plan: 1, project: 2, habit: 3, note: 4, automation: 5, template: 6 };
    return results.sort((a, b) => b.score - a.score || typeOrder[a.type] - typeOrder[b.type] || a.title.localeCompare(b.title, 'ja')).slice(0, options.limit || 60);
  }

  function diagnoseWorkspace(state, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const today = dateKey(now);
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const plans = Array.isArray(state.planItems) ? state.planItems : [];
    const projectIds = new Set(projects.map((project) => project.id));
    const taskIds = new Set(tasks.map((task) => task.id));
    const issues = [];
    const add = (issue) => issues.push(issue);

    const overdue = tasks.filter((task) => !task.done && task.due && task.due < today);
    if (overdue.length) add({ id: 'overdue', severity: 'attention', title: '期限切れミッション', detail: `${overdue.length}件が期限を過ぎています。`, count: overdue.length, entityIds: overdue.map((task) => task.id), fix: null });

    const orphanTasks = tasks.filter((task) => task.projectId && !projectIds.has(task.projectId));
    if (orphanTasks.length) add({ id: 'orphan-projects', severity: 'error', title: '存在しないプロジェクト参照', detail: `${orphanTasks.length}件の参照を「未分類」へ安全に戻せます。`, count: orphanTasks.length, entityIds: orphanTasks.map((task) => task.id), fix: 'clear_orphan_projects' });

    const brokenPlans = plans.filter((plan) => plan.taskId && !taskIds.has(plan.taskId));
    if (brokenPlans.length) add({ id: 'broken-plan-links', severity: 'error', title: '存在しないミッションへの予定リンク', detail: `${brokenPlans.length}件のリンクだけを解除できます。予定は残ります。`, count: brokenPlans.length, entityIds: brokenPlans.map((plan) => plan.id), fix: 'clear_broken_plan_links' });

    const duplicateGroups = new Map();
    tasks.filter((task) => !task.done).forEach((task) => {
      const key = `${normalizeSearchText(task.title)}|${task.due || ''}`;
      if (!key.startsWith('|')) duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), task]);
    });
    const duplicates = [...duplicateGroups.values()].filter((group) => group.length > 1);
    if (duplicates.length) {
      const extraIds = duplicates.flatMap((group) => group.slice(1).map((task) => task.id));
      add({ id: 'duplicates', severity: 'attention', title: '重複している可能性', detail: `${extraIds.length}件の完全一致を検出。古い1件を残して整理できます。`, count: extraIds.length, entityIds: extraIds, fix: 'remove_exact_duplicates' });
    }

    const conflictIds = new Set();
    const byDate = new Map();
    plans.filter((plan) => !plan.done).forEach((plan) => byDate.set(plan.date, [...(byDate.get(plan.date) || []), plan]));
    for (const dayPlans of byDate.values()) {
      const ordered = [...dayPlans].sort((a, b) => minutes(a.time) - minutes(b.time));
      let activePlan = null;
      let activeEnd = -1;
      for (const plan of ordered) {
        const start = minutes(plan.time);
        const end = start + Number(plan.duration || 30);
        if (activePlan && start < activeEnd) { conflictIds.add(activePlan.id); conflictIds.add(plan.id); }
        if (end > activeEnd) { activePlan = plan; activeEnd = end; }
      }
    }
    if (conflictIds.size) add({ id: 'plan-conflicts', severity: 'attention', title: '予定の重なり', detail: `${conflictIds.size}件を開始順に並べ直せます。`, count: conflictIds.size, entityIds: [...conflictIds], fix: 'resolve_plan_conflicts' });

    const staleWaiting = tasks.filter((task) => !task.done && task.status === 'waiting' && now.getTime() - new Date(task.createdAt || now).getTime() >= 14 * 86400000);
    if (staleWaiting.length) add({ id: 'stale-waiting', severity: 'info', title: '長期間WAITING', detail: `${staleWaiting.length}件を見直すタイミングです。`, count: staleWaiting.length, entityIds: staleWaiting.map((task) => task.id), fix: null });

    if (state.focusRuntime?.running && Number(state.focusRuntime.endAt) > 0 && Number(state.focusRuntime.endAt) < now.getTime() - 86400000) {
      add({ id: 'expired-focus', severity: 'error', title: '期限切れのタイマー状態', detail: '停止済み状態へ安全にリセットできます。', count: 1, entityIds: [], fix: 'reset_expired_focus' });
    }

    const penalty = issues.reduce((sum, issue) => sum + (issue.severity === 'error' ? 16 : issue.severity === 'attention' ? 8 : 3), 0);
    return { score: Math.max(0, 100 - penalty), issues, scannedAt: now.toISOString(), summary: issues.length ? `${issues.length}個の確認ポイント` : 'すべて正常です' };
  }

  function repairIssue(input, issue, options = {}) {
    const state = clone(input || {});
    const ids = new Set(issue?.entityIds || []);
    let changes = 0;
    if (issue?.fix === 'clear_orphan_projects') {
      for (const task of state.tasks || []) if (ids.has(task.id) && task.projectId) { task.projectId = null; changes += 1; }
    }
    if (issue?.fix === 'clear_broken_plan_links') {
      for (const plan of state.planItems || []) if (ids.has(plan.id) && plan.taskId) { plan.taskId = null; changes += 1; }
    }
    if (issue?.fix === 'remove_exact_duplicates') {
      const before = (state.tasks || []).length;
      state.tasks = (state.tasks || []).filter((task) => !ids.has(task.id));
      changes = before - state.tasks.length;
    }
    if (issue?.fix === 'resolve_plan_conflicts') {
      const byDate = new Map();
      (state.planItems || []).filter((plan) => !plan.done).forEach((plan) => byDate.set(plan.date, [...(byDate.get(plan.date) || []), plan]));
      for (const [originalDate, dayPlans] of byDate) {
        let cursor = 0;
        for (const plan of dayPlans.sort((a, b) => minutes(a.time) - minutes(b.time))) {
          let start = minutes(plan.time);
          if (start < cursor) {
            start = Math.ceil(cursor / 5) * 5;
            if (start + Number(plan.duration || 30) >= 24 * 60) { plan.date = addDays(originalDate, 1); start = 9 * 60; }
            plan.time = timeFromMinutes(start);
            changes += 1;
          }
          cursor = start + Number(plan.duration || 30);
        }
      }
    }
    if (issue?.fix === 'reset_expired_focus' && state.focusRuntime) {
      state.focusRuntime.running = false; state.focusRuntime.endAt = 0; state.focusRuntime.startedAt = null;
      state.focusRuntime.remaining = state.focusRuntime.total || (state.focusRuntime.minutes || 25) * 60;
      changes = 1;
    }
    state.diagnostics = { ...(state.diagnostics || {}), lastRepairAt: (options.now instanceof Date ? options.now : new Date(options.now || Date.now())).toISOString() };
    return { state, changes };
  }

  return {
    allowedConditions,
    allowedActions,
    defaultAutomationRules,
    defaultTemplates,
    normalizeRule,
    normalizeTemplate,
    runAutomationRules,
    instantiateTemplate,
    searchWorkspace,
    diagnoseWorkspace,
    repairIssue,
    dateKey
  };
});
