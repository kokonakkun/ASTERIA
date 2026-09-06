const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultState } = require('../src/store');
const {
  defaultAutomationRules,
  defaultTemplates,
  normalizeRule,
  runAutomationRules,
  instantiateTemplate,
  searchWorkspace,
  diagnoseWorkspace,
  repairIssue
} = require('../src/productivity-engine');

const fixedNow = new Date(2026, 8, 5, 8, 0, 0);
const sequentialIds = () => {
  let index = 0;
  return (prefix) => `${prefix}-${++index}`;
};

function cleanState() {
  const state = defaultState();
  state.tasks = [];
  state.projects = [];
  state.planItems = [];
  state.notes = '# Test Log';
  state.automations = { rules: [], history: [], lastRunAt: null };
  return state;
}

test('NEXUS ships predictable disabled rules and curated blueprints', () => {
  const rules = defaultAutomationRules();
  const templates = defaultTemplates();
  assert.equal(rules.length, 5);
  assert.ok(rules.every((rule) => rule.builtin && !rule.enabled));
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  assert.equal(templates.length, 4);
  assert.ok(templates.every((template) => template.tasks.length >= 3));
});

test('task automation changes only matching entities and records an auditable run', () => {
  const state = cleanState();
  state.tasks = [
    { id: 'late', title: 'Late', due: '2026-09-04', done: false, status: 'next', priority: 'low' },
    { id: 'today', title: 'Today', due: '2026-09-05', done: false, status: 'next', priority: 'medium' },
    { id: 'done', title: 'Done', due: '2026-09-04', done: true, status: 'done', priority: 'low' }
  ];
  state.automations.rules = [normalizeRule({ id: 'late-high', name: 'Late high', condition: 'overdue_open', action: 'priority_high', enabled: true })];
  const result = runAutomationRules(state, { now: fixedNow, idFactory: sequentialIds() });
  assert.equal(result.rulesRun, 1);
  assert.equal(result.changeCount, 1);
  assert.equal(result.state.tasks.find((task) => task.id === 'late').priority, 'high');
  assert.equal(result.state.tasks.find((task) => task.id === 'today').priority, 'medium');
  assert.equal(result.state.automations.history[0].count, 1);
  assert.equal(result.state.automations.rules[0].runCount, 1);
});

test('completion logging is idempotent across repeated automation runs', () => {
  const state = cleanState();
  state.tasks = [{ id: 'complete-a', title: 'Release complete', done: true, status: 'done', completedAt: '2026-09-05T02:00:00.000Z' }];
  state.automations.rules = [normalizeRule({ id: 'log', name: 'Log', condition: 'completed_today', action: 'append_log', enabled: true })];
  const first = runAutomationRules(state, { now: fixedNow, idFactory: sequentialIds() });
  const second = runAutomationRules(first.state, { now: fixedNow, idFactory: sequentialIds() });
  assert.equal(first.changeCount, 1);
  assert.equal(second.changeCount, 0);
  assert.equal((second.state.notes.match(/Release complete/g) || []).length, 1);
  assert.deepEqual(second.state.automations.rules[0].processedIds, ['complete-a']);
});

test('schedule automation finds free time without overlapping existing blocks', () => {
  const state = cleanState();
  state.tasks = [
    { id: 'a', title: 'A', done: false, status: 'next', priority: 'high', estimatedMinutes: 30 },
    { id: 'b', title: 'B', done: false, status: 'next', priority: 'high', estimatedMinutes: 45 }
  ];
  state.planItems = [{ id: 'busy', date: '2026-09-05', time: '09:00', duration: 60, title: 'Busy', done: false }];
  state.automations.rules = [normalizeRule({ id: 'schedule', name: 'Schedule', condition: 'high_priority_open', action: 'schedule_today', enabled: true })];
  const result = runAutomationRules(state, { now: fixedNow, idFactory: sequentialIds() });
  const generated = result.state.planItems.filter((plan) => plan.id !== 'busy');
  assert.deepEqual(generated.map((plan) => plan.time), ['10:00', '10:30']);
  assert.equal(generated[0].taskId, 'a');
  assert.equal(generated[1].taskId, 'b');
});

test('blueprint deployment creates a unique project, tasks, and linked blocks', () => {
  const state = cleanState();
  state.projects.push({ id: 'existing', name: 'Deep Work Sprint', color: 'violet' });
  const template = defaultTemplates()[0];
  const result = instantiateTemplate(state, template, { now: fixedNow, idFactory: sequentialIds() });
  const project = result.state.projects.find((item) => item.id === result.created.projectId);
  assert.equal(project.name, 'Deep Work Sprint 2');
  assert.equal(result.created.taskIds.length, 3);
  assert.equal(result.created.planIds.length, 1);
  assert.equal(result.state.planItems.at(-1).taskId, result.created.taskIds[1]);
  assert.equal(result.state.tasks.find((task) => task.id === result.created.taskIds[2]).due, '2026-09-06');
});

test('workspace search ranks and returns every supported entity family', () => {
  const state = cleanState();
  state.projects = [{ id: 'p', name: 'Orion', description: 'Project signal' }];
  state.tasks = [{ id: 't', title: 'Orion Mission', detail: 'prototype', projectId: 'p', category: 'WORK', priority: 'high' }];
  state.planItems = [{ id: 'plan', title: 'Orion Review', date: '2026-09-05', time: '10:00', duration: 30 }];
  state.habits = [{ id: 'habit', name: 'Orion Reading', target: 5 }];
  state.notes = '# Orion Notes\nOrion insight';
  state.automations.rules = [normalizeRule({ id: 'auto', name: 'Orion Automation', description: 'Orion' })];
  state.templates = [{ id: 'template', name: 'Orion Blueprint', description: 'Orion', tasks: [], plans: [] }];
  const results = searchWorkspace(state, 'orion');
  assert.deepEqual(new Set(results.map((result) => result.type)), new Set(['task', 'project', 'plan', 'habit', 'note', 'automation', 'template']));
  assert.ok(results[0].score >= results.at(-1).score);
  assert.ok(results.some((result) => result.type === 'project' && result.title === 'Orion'));
  assert.ok(results.every((result) => result.score > 0));
});

test('diagnostics finds broken references, exact duplicates, conflicts, and expired focus', () => {
  const state = cleanState();
  state.tasks = [
    { id: 'a', title: 'Duplicate', due: '2026-09-06', done: false, projectId: 'missing', createdAt: '2026-09-01T00:00:00Z' },
    { id: 'b', title: ' duplicate ', due: '2026-09-06', done: false, projectId: null, createdAt: '2026-09-02T00:00:00Z' }
  ];
  state.planItems = [
    { id: 'p1', title: 'First', date: '2026-09-05', time: '09:00', duration: 180, taskId: null, done: false },
    { id: 'p2', title: 'Second', date: '2026-09-05', time: '09:30', duration: 30, taskId: 'missing-task', done: false },
    { id: 'p3', title: 'Third', date: '2026-09-05', time: '10:30', duration: 30, taskId: null, done: false }
  ];
  state.focusRuntime = { running: true, endAt: fixedNow.getTime() - 2 * 86400000, total: 1500, minutes: 25 };
  const report = diagnoseWorkspace(state, { now: fixedNow });
  assert.ok(report.score < 100);
  assert.deepEqual(new Set(report.issues.map((issue) => issue.id)), new Set(['orphan-projects', 'broken-plan-links', 'duplicates', 'plan-conflicts', 'expired-focus']));
  assert.deepEqual(new Set(report.issues.find((issue) => issue.id === 'plan-conflicts').entityIds), new Set(['p1', 'p2', 'p3']));
});

test('every automatic diagnostic repair is scoped and reversible by snapshot', () => {
  const state = cleanState();
  state.tasks = [
    { id: 'a', title: 'Duplicate', due: '2026-09-06', done: false, projectId: 'missing', createdAt: '2026-09-01T00:00:00Z' },
    { id: 'b', title: 'Duplicate', due: '2026-09-06', done: false, projectId: null, createdAt: '2026-09-02T00:00:00Z' }
  ];
  state.planItems = [
    { id: 'p1', title: 'First', date: '2026-09-05', time: '09:00', duration: 60, taskId: null, done: false },
    { id: 'p2', title: 'Second', date: '2026-09-05', time: '09:30', duration: 30, taskId: 'missing-task', done: false }
  ];
  const snapshot = JSON.stringify(state);
  let current = state;
  for (const issue of diagnoseWorkspace(current, { now: fixedNow }).issues.filter((item) => item.fix)) {
    current = repairIssue(current, issue, { now: fixedNow }).state;
  }
  const report = diagnoseWorkspace(current, { now: fixedNow });
  assert.ok(!report.issues.some((issue) => ['orphan-projects', 'broken-plan-links', 'duplicates', 'plan-conflicts'].includes(issue.id)));
  assert.equal(current.tasks.length, 1);
  assert.equal(current.tasks[0].projectId, null);
  assert.equal(current.planItems[1].taskId, null);
  assert.equal(current.planItems[1].time, '10:00');
  assert.equal(JSON.parse(snapshot).tasks.length, 2);
});
