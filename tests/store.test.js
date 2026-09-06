const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JsonStore, defaultState, normalizeState, todayKey } = require('../src/store');
const { conflictIds, autoPlan } = require('../src/renderer/planning');

test('default state is immediately usable', () => {
  const state = defaultState();
  assert.equal(state.version, 7);
  assert.ok(Array.isArray(state.tasks));
  assert.ok(state.tasks.length >= 1);
  assert.equal(state.habits.length, 2);
  assert.equal(state.focusRuntime.remaining, 1500);
  assert.equal(state.energyEntries[0].date, todayKey());
  assert.equal(state.tasks[0].estimatedMinutes, 25);
  assert.equal(state.projects.length, 1);
  assert.equal(state.tasks[0].status, 'next');
  assert.equal(state.settings.appearance, 'system');
  assert.equal(state.settings.accentColor, '#8f7cf7');
  assert.deepEqual(state.integrations.history, []);
  assert.equal(state.automations.rules.length, 5);
  assert.equal(state.templates.length, 4);
  assert.equal(state.diagnostics.lastScore, null);
});

test('normalization repairs incomplete data and clamps settings', () => {
  const state = normalizeState({ profile: { name: '' }, settings: { volume: 7, weeklyGoal: -2 }, tasks: [] });
  assert.equal(state.profile.name, 'Explorer');
  assert.equal(state.settings.volume, 1);
  assert.equal(state.settings.weeklyGoal, 1);
  assert.deepEqual(state.tasks, []);
  assert.ok(Array.isArray(state.focusSessions));
  assert.ok(Array.isArray(state.planItems));
});

test('version 1 data migrates without inventing user habits', () => {
  const state = normalizeState({ version: 1, tasks: [], focusSessions: [], notes: 'legacy' });
  assert.equal(state.version, 7);
  assert.equal(state.notes, 'legacy');
  assert.deepEqual(state.habits, []);
  assert.equal(state.focusRuntime.phase, 'focus');
});

test('older tasks gain safe recurrence, subtask, and estimate defaults', () => {
  const state = normalizeState({ version: 2, tasks: [{ id: 'a', title: 'legacy task' }], focusSessions: [] });
  assert.equal(state.version, 7);
  assert.equal(state.tasks[0].recurrence, 'none');
  assert.deepEqual(state.tasks[0].subtasks, []);
  assert.equal(state.tasks[0].estimatedMinutes, 25);
  assert.equal(state.tasks[0].status, 'next');
  assert.equal(state.tasks[0].projectId, null);
  assert.equal(state.settings.closeToTray, false);
});

test('version 3 tasks migrate estimates and auto-plan metadata safely', () => {
  const state = normalizeState({
    version: 3,
    tasks: [{ id: 'a', title: 'short', estimatedMinutes: 999 }],
    focusSessions: [],
    planItems: [{ id: 'p', title: 'generated', date: '2026-09-04', time: '10:00', duration: 25, autoPlanned: 1 }]
  });
  assert.equal(state.version, 7);
  assert.equal(state.tasks[0].estimatedMinutes, 240);
  assert.equal(state.planItems[0].autoPlanned, true);
});

test('version 4 projects and board statuses migrate without losing relationships', () => {
  const state = normalizeState({
    version: 4,
    projects: [{ id: 'project-a', name: 'Launch', color: 'cyan' }],
    tasks: [{ id: 'task-a', title: 'Blocked', status: 'waiting', projectId: 'project-a', done: false }],
    focusSessions: []
  });
  assert.equal(state.version, 7);
  assert.equal(state.projects[0].name, 'Launch');
  assert.equal(state.tasks[0].status, 'waiting');
  assert.equal(state.tasks[0].projectId, 'project-a');
});

test('version 5 appearance migrates to dark without changing the familiar look', () => {
  const state = normalizeState({ version: 5, settings: { theme: 'cyan' }, tasks: [], focusSessions: [] });
  assert.equal(state.version, 7);
  assert.equal(state.settings.appearance, 'dark');
  assert.equal(state.settings.accentColor, '#27b8c0');
  assert.equal(state.settings.motionIntensity, 'expressive');
});

test('version 6 appearance and transfer history are normalized safely', () => {
  const state = normalizeState({
    version: 6,
    settings: { appearance: 'sepia', theme: 'custom', accentColor: 'red', motionIntensity: 'wild' },
    integrations: { history: [{ direction: 'import', service: 'Todoist', format: 'csv', count: -4, fileName: 'tasks.csv' }] },
    tasks: [],
    focusSessions: []
  });
  assert.equal(state.settings.appearance, 'system');
  assert.equal(state.settings.accentColor, '#8f7cf7');
  assert.equal(state.settings.motionIntensity, 'expressive');
  assert.equal(state.integrations.history[0].direction, 'import');
  assert.equal(state.integrations.history[0].count, 0);
});

test('version 6 workspaces gain NEXUS defaults without losing 3.0 preferences or history', () => {
  const state = normalizeState({
    version: 6,
    settings: { appearance: 'light', theme: 'custom', accentColor: '#e91e63', motionIntensity: 'gentle' },
    integrations: { history: [{ id: 'x', direction: 'export', service: 'Notion', format: 'md', count: 1 }] },
    tasks: [],
    focusSessions: []
  });
  assert.equal(state.version, 7);
  assert.equal(state.settings.appearance, 'light');
  assert.equal(state.settings.accentColor, '#e91e63');
  assert.equal(state.settings.motionIntensity, 'gentle');
  assert.equal(state.integrations.history[0].service, 'Notion');
  assert.equal(state.automations.rules.length, 5);
  assert.ok(state.automations.rules.every((rule) => !rule.enabled));
  assert.equal(state.templates.length, 4);
});

test('custom NEXUS rules and blueprints survive normalization beside built-ins', () => {
  const state = normalizeState({
    version: 7,
    automations: { rules: [{ id: 'custom-rule', name: 'Capture', condition: 'no_due_open', action: 'set_due_today', enabled: true }] },
    templates: [{ id: 'custom-template', name: 'Report', description: 'Monthly', color: 'green', tasks: [{ title: 'Draft report' }], plans: [] }],
    tasks: [],
    focusSessions: []
  });
  assert.equal(state.automations.rules.length, 6);
  assert.equal(state.automations.rules.find((rule) => rule.id === 'custom-rule').enabled, true);
  assert.equal(state.templates.length, 5);
  assert.equal(state.templates.find((template) => template.id === 'custom-template').tasks[0].title, 'Draft report');
});

test('planner and habit input is normalized safely', () => {
  const state = normalizeState({
    habits: [{ name: 'x', target: 99, color: 'unknown', completions: ['2026-09-04', 'bad-date'] }],
    planItems: [{ title: '予定', date: 'bad', time: '88:00', duration: 9999 }]
  });
  assert.equal(state.habits[0].target, 7);
  assert.equal(state.habits[0].color, 'violet');
  assert.deepEqual(state.habits[0].completions, ['2026-09-04']);
  assert.equal(state.planItems[0].time, '09:00');
  assert.equal(state.planItems[0].duration, 480);
});

test('store saves and loads unicode content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asteria-test-'));
  const store = new JsonStore(directory);
  const state = defaultState();
  state.notes = '星の記録 — 日本語も安全';
  store.save(state);
  const loaded = store.load();
  assert.equal(loaded.notes, state.notes);
  assert.equal(loaded.meta.launchCount, 2);
  store.save(loaded);
  const savedAgain = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
  assert.equal(savedAgain.meta.launchCount, 2);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('store restores the last known good backup after corruption', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asteria-recovery-test-'));
  const store = new JsonStore(directory);
  const first = defaultState();
  first.notes = 'recover me';
  store.save(first);
  const second = { ...first, notes: 'newer state' };
  store.save(second);
  fs.writeFileSync(store.filePath, '{broken json', 'utf8');
  const recovered = store.load();
  assert.equal(recovered.notes, 'recover me');
  assert.ok(fs.readdirSync(directory).some((name) => name.startsWith('asteria-recovery-')));
  fs.rmSync(directory, { recursive: true, force: true });
});

test('invalid imports are rejected', () => {
  assert.throws(() => JsonStore.validateImport({ tasks: [] }), /ASTERIA/);
  assert.throws(() => JsonStore.validateImport(null), /形式/);
});

test('planner detects overlaps but accepts adjacent blocks', () => {
  const items = [
    { id: 'a', date: '2026-09-04', time: '09:00', duration: 60, done: false },
    { id: 'b', date: '2026-09-04', time: '09:45', duration: 30, done: false },
    { id: 'c', date: '2026-09-04', time: '10:15', duration: 30, done: false },
    { id: 'done', date: '2026-09-04', time: '09:10', duration: 20, done: true }
  ];
  assert.deepEqual(new Set(conflictIds(items, '2026-09-04')), new Set(['a', 'b']));
});

test('auto planner prioritizes urgent work and avoids occupied time', () => {
  const tasks = [
    { id: 'low', title: 'Later', priority: 'low', due: '2026-09-10', estimatedMinutes: 30, done: false },
    { id: 'urgent', title: 'Urgent', priority: 'high', due: '2026-09-03', estimatedMinutes: 45, done: false },
    { id: 'linked', title: 'Already planned', priority: 'high', due: '2026-09-04', estimatedMinutes: 25, done: false },
    { id: 'waiting', title: 'Waiting', priority: 'high', due: '2026-09-01', estimatedMinutes: 25, status: 'waiting', done: false }
  ];
  const planItems = [{ id: 'busy', date: '2026-09-04', time: '09:00', duration: 60, taskId: 'linked', done: false }];
  const result = autoPlan({ tasks, planItems, date: '2026-09-04', startMinute: 9 * 60, endMinute: 12 * 60, maxItems: 2 });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.taskId), ['urgent', 'low']);
  assert.deepEqual(result.map((item) => item.time), ['10:00', '10:45']);
  assert.equal(conflictIds([...planItems, ...result.map((item, index) => ({ ...item, id: `new-${index}`, date: '2026-09-04', done: false }))], '2026-09-04').length, 0);
});
