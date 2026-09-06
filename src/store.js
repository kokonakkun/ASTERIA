const fs = require('node:fs');
const path = require('node:path');
const { defaultAutomationRules, defaultTemplates, normalizeRule, normalizeTemplate } = require('./productivity-engine');

const CURRENT_VERSION = 7;

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultState() {
  const now = new Date();
  const today = todayKey(now);
  return {
    version: CURRENT_VERSION,
    profile: {
      name: 'Explorer',
      intention: '今日いちばん大切なことを、静かに前へ進める。'
    },
    settings: {
      theme: 'violet',
      appearance: 'system',
      accentColor: '#8f7cf7',
      motionIntensity: 'expressive',
      notifications: true,
      soundscape: 'cosmos',
      volume: 0.32,
      weeklyGoal: 12,
      customFocusMinutes: 40,
      reducedMotion: false,
      closeToTray: false
    },
    projects: [
      {
        id: 'project-personal-orbit',
        name: 'Personal Orbit',
        description: '日々の前進と、自分のための大切なこと。',
        color: 'violet',
        archived: false,
        createdAt: now.toISOString()
      }
    ],
    tasks: [
      {
        id: 'starter-1',
        title: '今日の最重要ミッションを決める',
        detail: '迷ったら、終わったときに一番気持ちが軽くなるものを選びましょう。',
        priority: 'high',
        category: 'FOCUS',
        due: today,
        done: false,
        status: 'next',
        projectId: 'project-personal-orbit',
        recurrence: 'none',
        seriesId: null,
        estimatedMinutes: 25,
        subtasks: [],
        createdAt: now.toISOString(),
        completedAt: null
      },
      {
        id: 'starter-2',
        title: '25分だけ集中してみる',
        detail: 'FOCUS画面からタイマーを始められます。',
        priority: 'medium',
        category: 'GROWTH',
        due: today,
        done: false,
        status: 'next',
        projectId: 'project-personal-orbit',
        recurrence: 'none',
        seriesId: null,
        estimatedMinutes: 25,
        subtasks: [],
        createdAt: now.toISOString(),
        completedAt: null
      }
    ],
    notes: `# Captain's Log\n\nここは、思考をそのまま置いておける場所です。\n\n- 今日わかったこと\n- 次に試したいこと\n- 忘れたくない小さな発見`,
    focusSessions: [],
    focusRuntime: {
      phase: 'focus',
      minutes: 25,
      breakMinutes: 5,
      total: 1500,
      remaining: 1500,
      running: false,
      endAt: 0,
      startedAt: null,
      taskId: null,
      updatedAt: now.toISOString()
    },
    habits: [
      { id: 'starter-habit-water', name: '水をしっかり飲む', color: 'cyan', target: 7, completions: [] },
      { id: 'starter-habit-reflect', name: '5分だけ振り返る', color: 'violet', target: 5, completions: [] }
    ],
    planItems: [],
    energyEntries: [{ date: today, value: 4 }],
    achievements: [],
    integrations: {
      history: []
    },
    automations: {
      rules: defaultAutomationRules(),
      history: [],
      lastRunAt: null
    },
    templates: defaultTemplates(),
    diagnostics: {
      lastScanAt: null,
      lastScore: null,
      lastRepairAt: null
    },
    meta: {
      createdAt: now.toISOString(),
      lastOpenedAt: now.toISOString(),
      launchCount: 1
    }
  };
}

function normalizeState(input, { incrementLaunch = false } = {}) {
  const base = defaultState();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  const incomingVersion = Number(input.version || 0);

  const state = {
    ...base,
    ...input,
    version: CURRENT_VERSION,
    profile: { ...base.profile, ...(input.profile || {}) },
    settings: { ...base.settings, ...(input.settings || {}) },
    meta: { ...base.meta, ...(input.meta || {}) },
    projects: Array.isArray(input.projects) ? input.projects : (Number(input.version || 0) > 0 ? [] : base.projects),
    tasks: Array.isArray(input.tasks) ? input.tasks : base.tasks,
    focusSessions: Array.isArray(input.focusSessions) ? input.focusSessions : [],
    focusRuntime: { ...base.focusRuntime, ...(input.focusRuntime || {}) },
    habits: Array.isArray(input.habits) ? input.habits : (Number(input.version || 0) > 0 ? [] : base.habits),
    planItems: Array.isArray(input.planItems) ? input.planItems : [],
    energyEntries: Array.isArray(input.energyEntries) ? input.energyEntries : base.energyEntries,
    achievements: Array.isArray(input.achievements) ? input.achievements : [],
    integrations: { ...base.integrations, ...(input.integrations || {}) },
    automations: { ...base.automations, ...(input.automations || {}) },
    templates: Array.isArray(input.templates) ? input.templates : base.templates,
    diagnostics: { ...base.diagnostics, ...(input.diagnostics || {}) }
  };

  state.profile.name = String(state.profile.name || 'Explorer').slice(0, 40);
  state.profile.intention = String(state.profile.intention || '').slice(0, 180);
  state.notes = String(state.notes || '').slice(0, 200000);
  state.settings.weeklyGoal = Math.min(50, Math.max(1, Number(state.settings.weeklyGoal) || 12));
  state.settings.volume = Math.min(1, Math.max(0, Number(state.settings.volume) || 0));
  state.settings.customFocusMinutes = Math.min(180, Math.max(5, Number(state.settings.customFocusMinutes) || 40));
  state.settings.theme = ['violet', 'cyan', 'amber', 'custom'].includes(state.settings.theme) ? state.settings.theme : 'violet';
  state.settings.appearance = ['light', 'dark', 'system'].includes(input.settings?.appearance)
    ? input.settings.appearance
    : incomingVersion >= 6 ? 'system' : 'dark';
  state.settings.accentColor = /^#[0-9a-f]{6}$/i.test(String(input.settings?.accentColor || ''))
    ? String(input.settings.accentColor).toLowerCase()
    : ({ violet: '#8f7cf7', cyan: '#27b8c0', amber: '#d88418' }[state.settings.theme] || '#8f7cf7');
  state.settings.motionIntensity = ['expressive', 'gentle'].includes(input.settings?.motionIntensity) ? input.settings.motionIntensity : 'expressive';
  state.settings.reducedMotion = Boolean(state.settings.reducedMotion);
  state.settings.closeToTray = Boolean(state.settings.closeToTray);
  state.projects = state.projects.slice(0, 50).map((project, index) => ({
    id: String(project?.id || `project-${index}-${Date.now()}`).slice(0, 100),
    name: String(project?.name || '名称未設定プロジェクト').slice(0, 80),
    description: String(project?.description || '').slice(0, 240),
    color: ['violet', 'cyan', 'amber', 'green'].includes(project?.color) ? project.color : 'violet',
    archived: Boolean(project?.archived),
    createdAt: project?.createdAt || new Date().toISOString()
  }));
  state.tasks = state.tasks.slice(0, 5000).map((task, index) => {
    const done = Boolean(task?.done || task?.status === 'done');
    return {
      ...task,
      id: String(task?.id || `task-${index}-${Date.now()}`).slice(0, 100),
      title: String(task?.title || '新しいミッション').slice(0, 100),
      detail: String(task?.detail || '').slice(0, 500),
      done,
      status: done ? 'done' : ['backlog', 'next', 'waiting'].includes(task?.status) ? task.status : 'next',
      projectId: task?.projectId ? String(task.projectId).slice(0, 100) : null,
      recurrence: ['none', 'daily', 'weekdays', 'weekly'].includes(task?.recurrence) ? task.recurrence : 'none',
      seriesId: task?.seriesId ? String(task.seriesId).slice(0, 100) : null,
      estimatedMinutes: Math.min(240, Math.max(5, Math.round((Number(task?.estimatedMinutes) || 25) / 5) * 5)),
      subtasks: Array.isArray(task?.subtasks) ? task.subtasks.slice(0, 50).map((subtask, subIndex) => ({
        id: String(subtask?.id || `subtask-${subIndex}-${Date.now()}`).slice(0, 100),
        title: String(subtask?.title || 'サブタスク').slice(0, 120),
        done: Boolean(subtask?.done)
      })) : []
    };
  });
  state.habits = state.habits.slice(0, 30).map((habit, index) => ({
    id: String(habit?.id || `habit-${index}-${Date.now()}`).slice(0, 100),
    name: String(habit?.name || '新しい習慣').slice(0, 80),
    color: ['violet', 'cyan', 'amber', 'green'].includes(habit?.color) ? habit.color : 'violet',
    target: Math.min(7, Math.max(1, Number(habit?.target) || 5)),
    completions: Array.isArray(habit?.completions) ? [...new Set(habit.completions.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date))))].slice(-730) : []
  }));
  state.planItems = state.planItems.slice(0, 1000).map((item, index) => ({
    id: String(item?.id || `plan-${index}-${Date.now()}`).slice(0, 100),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(item?.date)) ? String(item.date) : todayKey(),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(item?.time)) ? String(item.time) : '09:00',
    duration: Math.min(480, Math.max(5, Number(item?.duration) || 30)),
    title: String(item?.title || '予定').slice(0, 100),
    taskId: item?.taskId ? String(item.taskId).slice(0, 100) : null,
    done: Boolean(item?.done),
    reminderMinutes: [-1, 0, 5, 10, 15, 30].includes(Number(item?.reminderMinutes)) ? Number(item.reminderMinutes) : -1,
    reminderSentAt: item?.reminderSentAt || null,
    autoPlanned: Boolean(item?.autoPlanned),
    createdAt: item?.createdAt || new Date().toISOString()
  }));
  state.focusRuntime.phase = state.focusRuntime.phase === 'break' ? 'break' : 'focus';
  state.focusRuntime.minutes = Math.min(180, Math.max(1, Number(state.focusRuntime.minutes) || 25));
  state.focusRuntime.breakMinutes = Math.min(60, Math.max(1, Number(state.focusRuntime.breakMinutes) || 5));
  state.focusRuntime.total = Math.max(1, Number(state.focusRuntime.total) || state.focusRuntime.minutes * 60);
  state.focusRuntime.remaining = Math.min(state.focusRuntime.total, Math.max(0, Number(state.focusRuntime.remaining) || 0));
  state.focusRuntime.running = Boolean(state.focusRuntime.running && Number(state.focusRuntime.endAt) > 0);
  state.focusRuntime.endAt = Math.max(0, Number(state.focusRuntime.endAt) || 0);
  state.integrations.history = Array.isArray(state.integrations.history) ? state.integrations.history.slice(0, 50).map((entry, index) => ({
    id: String(entry?.id || `transfer-${index}-${Date.now()}`).slice(0, 100),
    direction: entry?.direction === 'import' ? 'import' : 'export',
    service: String(entry?.service || 'ASTERIA').slice(0, 40),
    format: String(entry?.format || 'json').slice(0, 20),
    count: Math.max(0, Number(entry?.count) || 0),
    fileName: String(entry?.fileName || '').slice(0, 180),
    at: entry?.at || new Date().toISOString()
  })) : [];
  const incomingRules = Array.isArray(input.automations?.rules) ? input.automations.rules : [];
  const incomingRuleMap = new Map(incomingRules.map((rule) => [String(rule?.id || ''), rule]));
  const builtInRuleIds = new Set(base.automations.rules.map((rule) => rule.id));
  state.automations.rules = [
    ...base.automations.rules.map((rule, index) => normalizeRule({ ...rule, ...(incomingRuleMap.get(rule.id) || {}) }, index)),
    ...incomingRules.filter((rule) => !builtInRuleIds.has(String(rule?.id || ''))).slice(0, 45).map((rule, index) => normalizeRule(rule, index + base.automations.rules.length))
  ];
  state.automations.history = Array.isArray(state.automations.history) ? state.automations.history.slice(0, 100).map((entry, index) => ({
    id: String(entry?.id || `automation-run-${index}-${Date.now()}`).slice(0, 100),
    ruleId: String(entry?.ruleId || '').slice(0, 100),
    ruleName: String(entry?.ruleName || '自動化').slice(0, 80),
    action: String(entry?.action || '').slice(0, 40),
    count: Math.max(0, Number(entry?.count) || 0),
    at: entry?.at || new Date().toISOString()
  })) : [];
  state.automations.lastRunAt = state.automations.lastRunAt || null;
  const incomingTemplates = Array.isArray(input.templates) ? input.templates : [];
  const incomingTemplateMap = new Map(incomingTemplates.map((template) => [String(template?.id || ''), template]));
  const builtInTemplateIds = new Set(base.templates.map((template) => template.id));
  state.templates = [
    ...base.templates.map((template, index) => normalizeTemplate({ ...template, ...(incomingTemplateMap.get(template.id) || {}), builtin: true }, index)),
    ...incomingTemplates.filter((template) => !builtInTemplateIds.has(String(template?.id || ''))).slice(0, 46).map((template, index) => normalizeTemplate(template, index + base.templates.length))
  ];
  state.diagnostics.lastScanAt = state.diagnostics.lastScanAt || null;
  state.diagnostics.lastScore = state.diagnostics.lastScore === null ? null : Math.min(100, Math.max(0, Number(state.diagnostics.lastScore) || 0));
  state.diagnostics.lastRepairAt = state.diagnostics.lastRepairAt || null;
  state.meta.lastOpenedAt = new Date().toISOString();
  state.meta.launchCount = Math.max(1, Number(state.meta.launchCount || 0) + (incrementLaunch ? 1 : 0));

  return state;
}

class JsonStore {
  constructor(directory, filename = 'asteria-data.json') {
    this.directory = directory;
    this.filePath = path.join(directory, filename);
    this.backupPath = path.join(directory, 'asteria-data.backup.json');
  }

  load() {
    fs.mkdirSync(this.directory, { recursive: true });
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const state = normalizeState(JSON.parse(raw), { incrementLaunch: true });
      this.save(state);
      return state;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        const backupName = `asteria-recovery-${Date.now()}.json`;
        try { fs.copyFileSync(this.filePath, path.join(this.directory, backupName)); } catch { /* best effort */ }
        try {
          const backup = normalizeState(JSON.parse(fs.readFileSync(this.backupPath, 'utf8')), { incrementLaunch: true });
          this.save(backup, { preserveCurrent: false });
          return backup;
        } catch { /* fall through to a clean state */ }
      }
      const state = defaultState();
      this.save(state, { preserveCurrent: false });
      return state;
    }
  }

  save(value, { preserveCurrent = true } = {}) {
    fs.mkdirSync(this.directory, { recursive: true });
    const state = normalizeState(value);
    const temporary = `${this.filePath}.tmp`;
    if (preserveCurrent && fs.existsSync(this.filePath)) {
      try {
        JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        fs.copyFileSync(this.filePath, this.backupPath);
      } catch { /* never replace a good backup with corrupt data */ }
    }
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporary, this.filePath);
    return state;
  }

  static validateImport(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('バックアップの形式が正しくありません。');
    }
    if (!Array.isArray(input.tasks) || !Array.isArray(input.focusSessions)) {
      throw new Error('ASTERIAのバックアップとして認識できません。');
    }
    return normalizeState(input);
  }
}

module.exports = { JsonStore, defaultState, normalizeState, todayKey, CURRENT_VERSION };
