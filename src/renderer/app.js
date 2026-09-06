(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pad = (number) => String(number).padStart(2, '0');
  const todayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const i18n = globalThis.AsteriaI18n;
  const tr = (source) => i18n?.t(source) || source;

  let state;
  let activeView = 'dashboard';
  let taskFilter = 'open';
  let saveHandle = null;
  let miniModeActive = false;
  let commandIndex = 0;
  let plannerDate = todayKey();
  let plannerMode = 'day';
  let missionMode = 'list';
  let projectFilter = 'all';
  let draggedTaskId = null;
  let restoredFocusExpired = false;
  let editingSubtasks = [];
  let lastReminderMinute = '';
  let activeNexusTab = 'automations';
  let diagnosticReport = null;
  let preferenceTransitionTimer = null;
  let preferencesReady = false;
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const focus = {
    phase: 'focus',
    minutes: 25,
    breakMinutes: 5,
    total: 25 * 60,
    remaining: 25 * 60,
    running: false,
    endAt: 0,
    startedAt: null,
    taskId: null,
    interval: null
  };

  const energyLabels = ['', '低速航行', 'ゆっくり', '通常運転', '安定航行', 'フルパワー'];
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const categoryColors = { WORK: 'var(--accent)', PERSONAL: 'var(--good)', GROWTH: 'var(--warn)', FOCUS: '#64b8f2' };
  const projectColors = { violet: '#9b7cff', cyan: '#48d5da', amber: '#f7b55f', green: '#55e6ad' };
  const themeSeeds = { violet: '#8f7cf7', cyan: '#27b8c0', amber: '#d88418' };
  const planning = globalThis.AsteriaPlanning;
  const engine = globalThis.AsteriaEngine;

  function hexToHsl(hex) {
    const value = String(hex || '#8f7cf7').replace('#', '');
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    const [red, green, blue] = channels;
    const max = Math.max(...channels); const min = Math.min(...channels); const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === red) hue = 60 * (((green - blue) / delta) % 6);
      else if (max === green) hue = 60 * ((blue - red) / delta + 2);
      else hue = 60 * ((red - green) / delta + 4);
    }
    if (hue < 0) hue += 360;
    const lightness = (max + min) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    return { hue, saturation: saturation * 100 };
  }

  function hslToHex(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, saturation)) / 100;
    const l = Math.max(0, Math.min(100, lightness)) / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const section = h / 60;
    const x = chroma * (1 - Math.abs((section % 2) - 1));
    const options = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
    const match = l - chroma / 2;
    return `#${options.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
  }

  function colorLuminance(hex) {
    const channels = String(hex).match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }

  function colorContrast(foreground, background) {
    const values = [colorLuminance(foreground), colorLuminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  }

  function accessibleOn(background, preferred) {
    if (colorContrast(preferred, background) >= 4.5) return preferred;
    return colorContrast('#000000', background) >= colorContrast('#ffffff', background) ? '#000000' : '#ffffff';
  }

  function enforcePaletteContrast(palette) {
    const pairs = [
      ['primary', 'on-primary'], ['primary-container', 'on-primary-container'],
      ['secondary', 'on-secondary'], ['secondary-container', 'on-secondary-container'],
      ['tertiary', 'on-tertiary'], ['tertiary-container', 'on-tertiary-container'],
      ['error', 'on-error'], ['error-container', 'on-error-container'],
      ['background', 'on-background'], ['surface', 'on-surface'],
      ['surface-variant', 'on-surface-variant'], ['inverse-surface', 'inverse-on-surface']
    ];
    pairs.forEach(([backgroundRole, foregroundRole]) => {
      palette[foregroundRole] = accessibleOn(palette[backgroundRole], palette[foregroundRole]);
    });
    return palette;
  }

  function paletteFromSeed(seed, scheme) {
    const { hue, saturation: rawSaturation } = hexToHsl(seed);
    const saturation = Math.max(38, Math.min(82, rawSaturation));
    const secondaryHue = hue + 24;
    const tertiaryHue = hue + 66;
    const neutralSaturation = Math.max(4, Math.min(12, saturation * .14));
    const tone = (targetHue, targetSaturation, lightness) => hslToHex(targetHue, targetSaturation, lightness);
    if (scheme === 'light') {
      return enforcePaletteContrast({
        primary: tone(hue, saturation, 39), 'on-primary': '#ffffff', 'primary-container': tone(hue, saturation * .72, 90), 'on-primary-container': tone(hue, saturation, 10),
        secondary: tone(secondaryHue, saturation * .38, 40), 'on-secondary': '#ffffff', 'secondary-container': tone(secondaryHue, saturation * .34, 90), 'on-secondary-container': tone(secondaryHue, saturation * .45, 10),
        tertiary: tone(tertiaryHue, saturation * .48, 40), 'on-tertiary': '#ffffff', 'tertiary-container': tone(tertiaryHue, saturation * .42, 90), 'on-tertiary-container': tone(tertiaryHue, saturation * .5, 10),
        error: '#ba1a1a', 'on-error': '#ffffff', 'error-container': '#ffdad6', 'on-error-container': '#410002',
        background: tone(hue, neutralSaturation, 98), 'on-background': tone(hue, neutralSaturation, 10), surface: tone(hue, neutralSaturation, 98), 'on-surface': tone(hue, neutralSaturation, 10),
        'surface-variant': tone(hue, neutralSaturation + 5, 90), 'on-surface-variant': tone(hue, neutralSaturation + 5, 30), outline: tone(hue, neutralSaturation + 4, 48), 'outline-variant': tone(hue, neutralSaturation + 4, 79),
        'surface-container-lowest': '#ffffff', 'surface-container-low': tone(hue, neutralSaturation, 96), 'surface-container': tone(hue, neutralSaturation, 94), 'surface-container-high': tone(hue, neutralSaturation, 92), 'surface-container-highest': tone(hue, neutralSaturation, 90),
        'inverse-surface': tone(hue, neutralSaturation, 20), 'inverse-on-surface': tone(hue, neutralSaturation, 95), 'inverse-primary': tone(hue, saturation, 80), scrim: '#000000', shadow: '#000000'
      });
    }
    return enforcePaletteContrast({
      primary: tone(hue, saturation, 80), 'on-primary': tone(hue, saturation, 20), 'primary-container': tone(hue, saturation * .72, 30), 'on-primary-container': tone(hue, saturation * .7, 90),
      secondary: tone(secondaryHue, saturation * .38, 80), 'on-secondary': tone(secondaryHue, saturation * .42, 20), 'secondary-container': tone(secondaryHue, saturation * .34, 30), 'on-secondary-container': tone(secondaryHue, saturation * .4, 90),
      tertiary: tone(tertiaryHue, saturation * .48, 80), 'on-tertiary': tone(tertiaryHue, saturation * .52, 20), 'tertiary-container': tone(tertiaryHue, saturation * .42, 30), 'on-tertiary-container': tone(tertiaryHue, saturation * .46, 90),
      error: '#ffb4ab', 'on-error': '#690005', 'error-container': '#93000a', 'on-error-container': '#ffdad6',
      background: tone(hue, neutralSaturation, 7), 'on-background': tone(hue, neutralSaturation, 90), surface: tone(hue, neutralSaturation, 7), 'on-surface': tone(hue, neutralSaturation, 90),
      'surface-variant': tone(hue, neutralSaturation + 5, 30), 'on-surface-variant': tone(hue, neutralSaturation + 5, 80), outline: tone(hue, neutralSaturation + 4, 60), 'outline-variant': tone(hue, neutralSaturation + 4, 30),
      'surface-container-lowest': tone(hue, neutralSaturation, 4), 'surface-container-low': tone(hue, neutralSaturation, 10), 'surface-container': tone(hue, neutralSaturation, 12), 'surface-container-high': tone(hue, neutralSaturation, 17), 'surface-container-highest': tone(hue, neutralSaturation, 22),
      'inverse-surface': tone(hue, neutralSaturation, 90), 'inverse-on-surface': tone(hue, neutralSaturation, 20), 'inverse-primary': tone(hue, saturation, 40), scrim: '#000000', shadow: '#000000'
    });
  }

  async function initialize() {
    state = await window.asteria.load();
    i18n?.start(state.settings.locale || 'system');
    const startupAutomation = engine.runAutomationRules(state);
    if (startupAutomation.rulesRun) {
      state = startupAutomation.state;
      await window.asteria.save(state);
    }
    applyDisplayPreferences();
    restoreFocusRuntime();
    bindEvents();
    buildCommandPalette();
    renderAll();
    if (focus.taskId && state.tasks.some((task) => task.id === focus.taskId && !task.done)) $('#focusTaskSelect').value = focus.taskId;
    if (restoredFocusExpired) completeFocusPhase(true);
    else if (focus.running) focus.interval = setInterval(tickFocus, 250);
    updateFocusDisplay();
    startClock();
    initializeStarfield();
    audioEngine.configure(state.settings.soundscape, state.settings.volume);
    window.asteria.setCloseToTray(state.settings.closeToTray);
    showToast('ASTERIA 4.5 ONLINE', focus.running ? '前回の集中タイマーを復元しました。' : 'Global Language Update を起動しました。');
  }

  function applyDisplayPreferences() {
    const appearance = state.settings.appearance || 'dark';
    const scheme = appearance === 'system' ? (systemThemeQuery.matches ? 'dark' : 'light') : appearance;
    const seed = state.settings.accentColor || themeSeeds[state.settings.theme] || themeSeeds.violet;
    const palette = paletteFromSeed(seed, scheme);
    document.body.dataset.theme = state.settings.theme || 'custom';
    document.body.dataset.colorScheme = scheme;
    document.body.dataset.motion = state.settings.motionIntensity || 'expressive';
    document.documentElement.style.colorScheme = scheme;
    Object.entries(palette).forEach(([role, color]) => document.body.style.setProperty(`--md-sys-color-${role}`, color));
    document.body.style.setProperty('--accent', palette.primary);
    document.body.style.setProperty('--accent-2', palette.secondary);
    document.body.style.setProperty('--accent-rgb', palette.primary.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(', '));
    document.body.style.setProperty('--bg', palette.background);
    document.body.style.setProperty('--bg-deep', palette['surface-container-lowest']);
    document.body.style.setProperty('--surface', palette['surface-container']);
    document.body.style.setProperty('--surface-strong', palette['surface-container-high']);
    document.body.style.setProperty('--surface-soft', palette['surface-container-low']);
    document.body.style.setProperty('--line', palette['outline-variant']);
    document.body.style.setProperty('--line-bright', palette.outline);
    document.body.style.setProperty('--text', palette['on-surface']);
    document.body.style.setProperty('--muted', palette['on-surface-variant']);
    document.body.style.setProperty('--subtle', palette.outline);
    document.body.style.setProperty('--danger', palette.error);
    document.body.classList.toggle('reduced-motion', Boolean(state.settings.reducedMotion));
    if (preferencesReady && !state.settings.reducedMotion) {
      document.body.classList.add('theme-changing');
      clearTimeout(preferenceTransitionTimer);
      preferenceTransitionTimer = setTimeout(() => document.body.classList.remove('theme-changing'), 480);
    }
    preferencesReady = true;
  }

  function restoreFocusRuntime() {
    const runtime = state.focusRuntime || {};
    focus.phase = runtime.phase === 'break' ? 'break' : 'focus';
    focus.minutes = Number(runtime.minutes || 25);
    focus.breakMinutes = Number(runtime.breakMinutes || 5);
    focus.total = Number(runtime.total || focus.minutes * 60);
    focus.remaining = Number.isFinite(Number(runtime.remaining)) ? Number(runtime.remaining) : focus.total;
    focus.running = Boolean(runtime.running);
    focus.endAt = Number(runtime.endAt || 0);
    focus.startedAt = runtime.startedAt || null;
    focus.taskId = runtime.taskId || null;
    if (focus.running) {
      focus.remaining = Math.max(0, Math.ceil((focus.endAt - Date.now()) / 1000));
      if (focus.remaining <= 0) {
        focus.running = false;
        restoredFocusExpired = true;
      }
    }
  }

  function persistFocusRuntime(delay = 80) {
    state.focusRuntime = focusRuntimeSnapshot();
    scheduleSave(delay);
  }

  function focusRuntimeSnapshot() {
    return {
      phase: focus.phase,
      minutes: focus.minutes,
      breakMinutes: focus.breakMinutes,
      total: focus.total,
      remaining: focus.remaining,
      running: focus.running,
      endAt: focus.endAt,
      startedAt: focus.startedAt,
      taskId: $('#focusTaskSelect')?.value || focus.taskId || null,
      updatedAt: new Date().toISOString()
    };
  }

  function bindEvents() {
    $$('[data-window]').forEach((button) => button.addEventListener('click', () => window.asteria.windowControl(button.dataset.window)));
    $$('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
    $('#quickAddButton').addEventListener('click', () => openTaskModal());
    $('#missionAddButton').addEventListener('click', () => openTaskModal());
    $('#projectAddButton').addEventListener('click', () => openProjectModal());
    $('#missionViewButton').addEventListener('click', toggleMissionMode);
    $('#taskForm').addEventListener('submit', saveTaskFromForm);
    $('#subtaskAddButton').addEventListener('click', addDraftSubtask);
    $('#subtaskInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftSubtask(); } });
    $('#subtaskDraftList').addEventListener('click', handleDraftSubtaskClick);
    $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeTaskModal));
    $('#taskModal').addEventListener('mousedown', (event) => { if (event.target === $('#taskModal')) closeTaskModal(); });

    $('#energySelector').addEventListener('click', (event) => {
      const button = event.target.closest('[data-energy]');
      if (!button) return;
      const value = Number(button.dataset.energy);
      const existing = state.energyEntries.find((entry) => entry.date === todayKey());
      if (existing) existing.value = value;
      else state.energyEntries.push({ date: todayKey(), value });
      renderEnergy();
      scheduleSave();
    });

    $('#intentionInput').addEventListener('input', (event) => {
      state.profile.intention = event.target.value;
      scheduleSave();
    });

    ['#dashboardNotes', '#fullNotes'].forEach((selector) => {
      $(selector).addEventListener('input', (event) => updateNotes(event.target.value, selector));
    });

    $$('.log-toolbar [data-insert]').forEach((button) => button.addEventListener('click', () => insertMarkdown(button.dataset.insert)));

    $('#dashboardTaskList').addEventListener('click', handleTaskListClick);
    $('#missionTaskList').addEventListener('click', handleTaskListClick);
    $('#taskSearch').addEventListener('input', renderMissionTasks);
    $('#taskSort').addEventListener('change', renderMissionTasks);
    $('#projectFilterSelect').addEventListener('change', (event) => { projectFilter = event.target.value; renderMissionTasks(); renderProjectStrip(); });
    $('#taskFilters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      taskFilter = button.dataset.filter;
      $$('#taskFilters button').forEach((item) => item.classList.toggle('active', item === button));
      renderMissionTasks();
    });

    $('#plannerPrev').addEventListener('click', () => shiftPlannerDate(-1));
    $('#plannerNext').addEventListener('click', () => shiftPlannerDate(1));
    $('#plannerTodayButton').addEventListener('click', () => { plannerDate = todayKey(); plannerMode = 'day'; renderPlanner(); });
    $('#plannerModeSwitch').addEventListener('click', (event) => { const button = event.target.closest('[data-planner-mode]'); if (button) { plannerMode = button.dataset.plannerMode; renderPlanner(); } });
    $('#plannerDateInput').addEventListener('change', (event) => { if (event.target.value) { plannerDate = event.target.value; renderPlanner(); } });
    $('#planAddButton').addEventListener('click', () => openPlanModal());
    $('#planInlineAdd').addEventListener('click', () => openPlanModal());
    $('#autoPlanButton').addEventListener('click', autoPlanDay);
    $('#planForm').addEventListener('submit', savePlanFromForm);
    $$('[data-close-plan]').forEach((button) => button.addEventListener('click', closePlanModal));
    $('#planModal').addEventListener('mousedown', (event) => { if (event.target === $('#planModal')) closePlanModal(); });
    $('#dayPlanList').addEventListener('click', handlePlanClick);
    $('#habitAddButton').addEventListener('click', () => openHabitModal());
    $('#habitForm').addEventListener('submit', saveHabitFromForm);
    $$('[data-close-habit]').forEach((button) => button.addEventListener('click', closeHabitModal));
    $('#habitModal').addEventListener('mousedown', (event) => { if (event.target === $('#habitModal')) closeHabitModal(); });
    $('#habitList').addEventListener('click', handleHabitClick);
    $('#monthGrid').addEventListener('click', (event) => {
      const cell = event.target.closest('[data-month-date]');
      if (!cell) return;
      plannerDate = cell.dataset.monthDate;
      plannerMode = 'day';
      renderPlanner();
    });
    $('#weekGrid').addEventListener('click', (event) => { const day = event.target.closest('[data-week-date]'); if (day) { plannerDate = day.dataset.weekDate; plannerMode = 'day'; renderPlanner(); } });
    $('#navigatorFocusButton').addEventListener('click', focusNavigatorSuggestion);

    $('#projectForm').addEventListener('submit', saveProjectFromForm);
    $('#projectDeleteButton').addEventListener('click', deleteProjectFromForm);
    $$('[data-close-project]').forEach((button) => button.addEventListener('click', closeProjectModal));
    $('#projectModal').addEventListener('mousedown', (event) => { if (event.target === $('#projectModal')) closeProjectModal(); });
    $('#projectStrip').addEventListener('click', handleProjectStripClick);
    $('#projectStrip').addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-project-filter]')) { event.preventDefault(); event.target.click(); } });
    $('#missionBoard').addEventListener('click', handleBoardClick);
    $('#missionBoard').addEventListener('dragstart', handleBoardDragStart);
    $('#missionBoard').addEventListener('dragend', handleBoardDragEnd);
    $('#missionBoard').addEventListener('dragover', handleBoardDragOver);
    $('#missionBoard').addEventListener('dragleave', handleBoardDragLeave);
    $('#missionBoard').addEventListener('drop', handleBoardDrop);

    $('#profileName').addEventListener('click', openSettings);
    $('#settingsButton').addEventListener('click', openSettings);
    $('#settingsForm').addEventListener('submit', (event) => { event.preventDefault(); updateSettingsFromForm(); closeSettings(); showToast('SETTINGS SAVED', '表示と集中設定を更新しました。'); });
    $$('[data-close-settings]').forEach((button) => button.addEventListener('click', closeSettings));
    $('#settingsModal').addEventListener('mousedown', (event) => { if (event.target === $('#settingsModal')) closeSettings(); });
    $('#settingName').addEventListener('input', updateSettingsFromForm);
    $('#settingGoal').addEventListener('input', updateSettingsFromForm);
    $('#settingCustomFocus').addEventListener('input', updateSettingsFromForm);
    $('#settingNotifications').addEventListener('change', updateSettingsFromForm);
    $('#settingReducedMotion').addEventListener('change', updateSettingsFromForm);
    $('#settingCloseToTray').addEventListener('change', updateSettingsFromForm);
    $('#settingMotionIntensity').addEventListener('change', updateSettingsFromForm);
    $('#settingLocale').addEventListener('change', () => {
      state.settings.locale = $('#settingLocale').value;
      i18n?.setLocale(state.settings.locale);
      buildCommandPalette();
      renderAll();
      scheduleSave();
    });
    $('#appearanceOptions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-appearance]');
      if (!button) return;
      state.settings.appearance = button.dataset.appearance;
      applyDisplayPreferences(); renderSettings(); renderChartsSoon(); scheduleSave();
    });
    $('#themeOptions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-theme-option]');
      if (!button) return;
      state.settings.theme = button.dataset.themeOption;
      state.settings.accentColor = themeSeeds[state.settings.theme];
      applyDisplayPreferences();
      renderThemeOptions();
      scheduleSave();
      renderChartsSoon();
    });
    $('#settingAccentColor').addEventListener('input', (event) => {
      state.settings.theme = 'custom'; state.settings.accentColor = event.target.value;
      $('#accentColorValue').value = event.target.value.toUpperCase();
      applyDisplayPreferences(); renderThemeOptions(); renderChartsSoon(); scheduleSave(120);
    });
    $('#resetAccentColor').addEventListener('click', () => {
      state.settings.theme = 'violet'; state.settings.accentColor = themeSeeds.violet;
      applyDisplayPreferences(); renderSettings(); renderChartsSoon(); scheduleSave();
    });
    systemThemeQuery.addEventListener('change', () => { if (state.settings.appearance === 'system') { applyDisplayPreferences(); renderChartsSoon(); } });
    $('#exportButton').addEventListener('click', () => openExchangeModal('export', 'backup', 'ASTERIA'));
    $('#exportFromInsights').addEventListener('click', () => openExchangeModal('export', 'backup', 'ASTERIA'));
    $('#importButton').addEventListener('click', () => openExchangeModal('import', 'auto', 'ASTERIA'));
    $('#integrationImportButton').addEventListener('click', () => openExchangeModal('import', 'auto', 'ASTERIA'));
    $('#integrationExportButton').addEventListener('click', () => openExchangeModal('export', 'backup', 'ASTERIA'));
    $('#integrationServices').addEventListener('click', handleIntegrationAction);
    $('#clearTransferHistory').addEventListener('click', clearTransferHistory);
    $('#exchangeForm').addEventListener('submit', runExchange);
    $$('[data-close-exchange]').forEach((button) => button.addEventListener('click', closeExchangeModal));
    $('#exchangeModal').addEventListener('mousedown', (event) => { if (event.target === $('#exchangeModal')) closeExchangeModal(); });

    $('#nexusTabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-nexus-tab]');
      if (!button) return;
      activeNexusTab = button.dataset.nexusTab;
      renderNexus();
    });
    $('#nexusTabs').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = $$('#nexusTabs [data-nexus-tab]');
      const current = Math.max(0, tabs.indexOf(document.activeElement));
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault(); tabs[index].focus(); tabs[index].click();
    });
    $('#nexusRunButton').addEventListener('click', () => runAutomations());
    $('#nexusScanButton').addEventListener('click', () => { activeNexusTab = 'health'; scanWorkspace(true); });
    $('#healthScanButton').addEventListener('click', () => scanWorkspace(true));
    $('#addAutomationButton').addEventListener('click', openAutomationModal);
    $('#automationForm').addEventListener('submit', saveAutomationFromForm);
    $$('[data-close-automation]').forEach((button) => button.addEventListener('click', closeAutomationModal));
    $('#automationModal').addEventListener('mousedown', (event) => { if (event.target === $('#automationModal')) closeAutomationModal(); });
    $('#automationList').addEventListener('click', handleAutomationAction);
    $('#clearAutomationHistory').addEventListener('click', clearAutomationHistory);
    $('#addTemplateButton').addEventListener('click', openTemplateModal);
    $('#templateForm').addEventListener('submit', saveTemplateFromForm);
    $$('[data-close-template]').forEach((button) => button.addEventListener('click', closeTemplateModal));
    $('#templateModal').addEventListener('mousedown', (event) => { if (event.target === $('#templateModal')) closeTemplateModal(); });
    $('#templateGrid').addEventListener('click', handleTemplateAction);
    $('#diagnosticList').addEventListener('click', handleDiagnosticAction);

    $('#modeSelector').addEventListener('click', (event) => {
      const button = event.target.closest('[data-minutes]');
      if (!button || focus.running) return;
      $$('#modeSelector button').forEach((item) => item.classList.toggle('active', item === button));
      focus.minutes = button.dataset.minutes === 'custom' ? Number(state.settings.customFocusMinutes || 40) : Number(button.dataset.minutes);
      focus.breakMinutes = Number(button.dataset.break);
      focus.phase = 'focus';
      focus.total = focus.minutes * 60;
      focus.remaining = focus.total;
      updateFocusDisplay();
      persistFocusRuntime();
    });
    $('#focusToggleButton').addEventListener('click', toggleFocus);
    $('#dashboardFocusToggle').addEventListener('click', toggleFocus);
    $('#miniToggle').addEventListener('click', toggleFocus);
    $('#focusResetButton').addEventListener('click', resetFocus);
    $('#focusSkipButton').addEventListener('click', skipFocusPhase);
    $('#focusTaskSelect').addEventListener('change', () => { focus.taskId = $('#focusTaskSelect').value || null; updateFocusDisplay(); persistFocusRuntime(); });
    $('#soundToggle').addEventListener('click', toggleSound);
    $('#soundOptions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-sound]');
      if (!button) return;
      state.settings.soundscape = button.dataset.sound;
      $$('#soundOptions button').forEach((item) => item.classList.toggle('active', item === button));
      audioEngine.configure(state.settings.soundscape, state.settings.volume);
      if (audioEngine.playing) audioEngine.restart();
      scheduleSave();
    });
    $('#volumeSlider').addEventListener('input', (event) => {
      state.settings.volume = Number(event.target.value) / 100;
      $('#volumeOutput').value = `${event.target.value}%`;
      audioEngine.setVolume(state.settings.volume);
      scheduleSave();
    });

    $('#miniModeButton').addEventListener('click', enterMiniMode);
    $('#focusMiniButton').addEventListener('click', enterMiniMode);
    $('#exitMiniButton').addEventListener('click', exitMiniMode);
    $('#commandButton').addEventListener('click', openCommandPalette);

    window.addEventListener('keydown', handleKeyboard);
    window.addEventListener('resize', renderChartsSoon);
    window.asteria.onNavigate((view) => navigate(view));
    window.addEventListener('beforeunload', () => {
      clearTimeout(saveHandle);
      state.focusRuntime = focusRuntimeSnapshot();
      window.asteria.saveSync(state);
    });
  }

  function renderAll() {
    renderHeader();
    renderEnergy();
    renderTasks();
    renderNavigator();
    renderPlanner();
    renderNotes();
    renderFocusTaskOptions();
    renderFocusSessions();
    renderStats();
    renderIntegrations();
    renderNexus();
    renderSettings();
    updateFocusDisplay();
    renderChartsSoon();
    i18n?.localize();
  }

  function startClock() {
    const tick = () => {
      const now = new Date();
      $('#liveClock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const hour = now.getHours();
      $('#greeting').textContent = hour < 5 ? '夜更けですね' : hour < 11 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';
      $('#dateLabel').textContent = i18n?.formatDate(now, { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }) || now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' });
      checkPlanReminders(now);
    };
    tick();
    setInterval(tick, 1000);
  }

  function renderHeader() {
    $('#profileName').textContent = state.profile.name || 'Explorer';
    if ($('#intentionInput') !== document.activeElement) $('#intentionInput').value = state.profile.intention || '';
  }

  function renderEnergy() {
    const entry = state.energyEntries.find((item) => item.date === todayKey());
    const energy = Number(entry?.value || 3);
    $$('#energySelector button').forEach((button) => {
      const active = Number(button.dataset.energy) <= energy;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#energyCopy').textContent = energyLabels[energy];
  }

  function renderNavigator() {
    const allOpen = state.tasks.filter((task) => !task.done);
    const open = allOpen.filter((task) => task.status !== 'waiting');
    const today = todayKey();
    const overdue = allOpen.filter((task) => task.due && task.due < today).length;
    const energy = Number(state.energyEntries.find((entry) => entry.date === today)?.value || 3);
    const scored = open.map((task) => {
      let score = task.priority === 'high' ? 50 : task.priority === 'medium' ? 25 : 10;
      if (task.status === 'next') score += 25;
      if (task.status === 'waiting') score -= 45;
      if (task.status === 'backlog') score -= 10;
      if (task.due && task.due < today) score += 80;
      else if (task.due === today) score += 45;
      if (energy <= 2 && task.priority === 'low') score += 22;
      if (energy <= 2 && Number(task.estimatedMinutes || 25) <= 25) score += 28;
      if (energy <= 2 && Number(task.estimatedMinutes || 25) >= 60) score -= 18;
      const remainingSubtasks = (task.subtasks || []).filter((item) => !item.done).length;
      if (remainingSubtasks === 1) score += 8;
      return { task, score };
    }).sort((a, b) => b.score - a.score);
    const suggestion = scored[0]?.task || null;
    const nextPlan = state.planItems.filter((item) => item.date === today && !item.done && item.time >= `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`).sort((a, b) => a.time.localeCompare(b.time))[0];

    $('#navigatorFocusButton').dataset.taskId = suggestion?.id || '';
    $('#navigatorFocusButton').disabled = !suggestion;
    if (suggestion) {
      const nextSubtask = (suggestion.subtasks || []).find((item) => !item.done);
      $('#navigatorTitle').textContent = suggestion.title;
      $('#navigatorMessage').textContent = nextSubtask ? `約${suggestion.estimatedMinutes || 25}分。まず「${nextSubtask.title}」から始めると、進みやすくなります。` : energy <= 2 ? `約${suggestion.estimatedMinutes || 25}分。最初の5分だけ着手して勢いをつくりましょう。` : `約${suggestion.estimatedMinutes || 25}分。期限と優先度から、いま最も効果の高いミッションです。`;
    } else {
      $('#navigatorTitle').textContent = 'すべてのミッションが完了しています';
      $('#navigatorMessage').textContent = '余白を楽しむか、次の軌道を計画しましょう。';
    }
    $('#navigatorBadges').innerHTML = `${overdue ? `<span class="alert">${overdue} OVERDUE</span>` : '<span>NO OVERDUE</span>'}<span>ENERGY ${energy}/5</span>${nextPlan ? `<span>NEXT ${escapeHtml(nextPlan.time)}</span>` : '<span>OPEN SCHEDULE</span>'}`;
  }

  function focusNavigatorSuggestion() {
    const taskId = $('#navigatorFocusButton').dataset.taskId;
    if (!taskId) { navigate('planner'); return; }
    $('#focusTaskSelect').value = taskId;
    focus.taskId = taskId;
    navigate('focus');
    updateFocusDisplay();
    persistFocusRuntime();
  }

  function scheduleSave(delay = 500) {
    clearTimeout(saveHandle);
    setSaveIndicator(false);
    saveHandle = setTimeout(async () => {
      await window.asteria.save(state);
      setSaveIndicator(true);
    }, delay);
  }

  function setSaveIndicator(saved) {
    $('#noteSaveState').innerHTML = `<i></i> ${saved ? 'SAVED' : 'SAVING'}`;
    $('#fullNoteSaveState').textContent = saved ? 'すべて保存済み' : '保存中…';
  }

  function navigate(view) {
    if (!view) return;
    activeView = view;
    $$('.view').forEach((section) => section.classList.toggle('active', section.dataset.view === view));
    $$('.primary-nav .nav-button').forEach((button) => {
      const current = button.dataset.nav === view;
      button.classList.toggle('active', current);
      if (current) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (view === 'insights' || view === 'dashboard') renderChartsSoon();
    if (view === 'integrations') renderIntegrations();
    if (view === 'nexus') renderNexus();
    if (view === 'logbook') $('#fullNotes').focus();
  }

  function getTodayTasks() {
    const today = todayKey();
    return state.tasks.filter((task) => !task.done && (!task.due || task.due <= today));
  }

  function sortedTasks(tasks, sort = 'priority') {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999');
      if (sort === 'created') return String(b.createdAt).localeCompare(String(a.createdAt));
      return (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2) || (a.due || '9999').localeCompare(b.due || '9999');
    });
  }

  function taskMarkup(task, full = false) {
    const dueText = formatDue(task.due);
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const subtaskDone = subtasks.filter((item) => item.done).length;
    const recurrenceLabels = { daily: tr('毎日'), weekdays: tr('平日'), weekly: tr('毎週') };
    const project = state.projects.find((item) => item.id === task.projectId);
    const projectColor = projectColors[project?.color] || '#777382';
    return `<div class="task-row ${task.done ? 'done' : ''}" data-task-id="${escapeHtml(task.id)}" style="--project-color:${projectColor}">
      <button type="button" class="task-check" data-action="toggle" aria-label="${task.done ? '未完了に戻す' : '完了にする'}"></button>
      <div class="task-main">
        <p class="task-title">${escapeHtml(task.title)}</p>
        ${full && task.detail ? `<p class="task-detail">${escapeHtml(task.detail)}</p>` : ''}
        <div class="task-meta"><i class="priority-dot ${escapeHtml(task.priority)}"></i><span>${escapeHtml(String(task.priority || 'low').toUpperCase())}</span><span>·</span><span class="task-status ${escapeHtml(task.status || (task.done ? 'done' : 'next'))}">${escapeHtml(String(task.status || (task.done ? 'done' : 'next')).toUpperCase())}</span>${project ? `<span>·</span><span class="task-project-badge">${escapeHtml(project.name)}</span>` : ''}${dueText ? `<span>·</span><span>${escapeHtml(dueText)}</span>` : ''}<span>·</span><span class="task-estimate">◷ ${Number(task.estimatedMinutes || 25)} MIN</span>${task.recurrence && task.recurrence !== 'none' ? `<span>·</span><span class="recurrence-badge">↻ ${recurrenceLabels[task.recurrence]}</span>` : ''}</div>
        ${full && subtasks.length ? `<div class="subtask-progress"><span><i style="--subtask-progress:${Math.round((subtaskDone / subtasks.length) * 100)}%"></i></span><small>${subtaskDone}/${subtasks.length} SUBTASKS</small></div><div class="subtask-list">${subtasks.map((subtask) => `<button type="button" class="subtask-item ${subtask.done ? 'done' : ''}" data-action="subtask-toggle" data-subtask-id="${escapeHtml(subtask.id)}"><i></i><span>${escapeHtml(subtask.title)}</span></button>`).join('')}</div>` : ''}
      </div>
      ${full ? `<span class="task-tag" style="color:${categoryColors[task.category] || 'var(--accent)'}">${escapeHtml(task.category || 'WORK')}</span>` : ''}
      <div class="task-row-actions">
        <button type="button" data-action="focus" aria-label="集中する"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/></svg></button>
        <button type="button" data-action="snooze" aria-label="期限を1日延ばす"><svg viewBox="0 0 24 24"><path d="M5 12h12m-4-4 4 4-4 4"/><path d="M6 5v3M4.5 6.5h3"/></svg></button>
        <button type="button" data-action="edit" aria-label="編集"><svg viewBox="0 0 24 24"><path d="m14 5 5 5L9 20H4v-5zM12 7l5 5"/></svg></button>
        <button type="button" data-action="delete" class="danger" aria-label="削除"><svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M6 7l1 14h10l1-14"/></svg></button>
      </div>
    </div>`;
  }

  function renderTasks() {
    const todayTasks = sortedTasks(getTodayTasks()).slice(0, 6);
    $('#dashboardTaskList').innerHTML = todayTasks.length
      ? todayTasks.map((task) => taskMarkup(task)).join('')
      : '<div class="empty-state"><div><strong>軌道はクリアです</strong><span>新しいミッションを追加しましょう。</span></div></div>';
    $('#openTaskCount').textContent = state.tasks.filter((task) => !task.done).length;
    renderProjectControls();
    renderProjectStrip();
    renderMissionTasks();
    renderFocusTaskOptions();
    renderPlanTaskOptions();
    renderNavigator();
  }

  function renderProjectControls() {
    const projects = state.projects.filter((project) => !project.archived);
    if (projectFilter !== 'all' && projectFilter !== 'none' && !projects.some((project) => project.id === projectFilter)) projectFilter = 'all';
    $('#projectFilterSelect').innerHTML = `<option value="all">すべてのプロジェクト</option><option value="none">プロジェクトなし</option>${projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('')}`;
    $('#projectFilterSelect').value = projectFilter;
    const previousTaskProject = $('#taskProject').value;
    $('#taskProject').innerHTML = `<option value="">プロジェクトなし</option>${projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('')}`;
    if (projects.some((project) => project.id === previousTaskProject)) $('#taskProject').value = previousTaskProject;
  }

  function renderProjectStrip() {
    const projects = state.projects.filter((project) => !project.archived);
    const card = (project) => {
      const tasks = project ? state.tasks.filter((task) => task.projectId === project.id) : state.tasks;
      const done = tasks.filter((task) => task.done).length;
      const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      const id = project?.id || 'all';
      const color = project ? projectColors[project.color] || '#9b7cff' : '#9b7cff';
      return `<div class="project-card ${project ? '' : 'all-projects'} ${projectFilter === id ? 'active' : ''}" data-project-filter="${escapeHtml(id)}" role="button" tabindex="0" style="--project-color:${color};--project-progress:${progress}%"><div class="project-card-main"><strong>${escapeHtml(project?.name || 'All Missions')}</strong><small>${project ? escapeHtml(project.description || `${tasks.length}件のミッション`) : `${projects.length} PROJECTS · ${tasks.length} MISSIONS`}</small></div>${project ? `<button type="button" class="project-edit" data-project-edit="${escapeHtml(project.id)}" aria-label="${escapeHtml(project.name)}を編集">•••</button>` : ''}<div class="project-card-progress"><i></i></div></div>`;
    };
    $('#projectStrip').innerHTML = [card(null), ...projects.map(card)].join('');
  }

  function missionMatchesScope(task, { includeStatusFilter = true } = {}) {
    const query = ($('#taskSearch')?.value || '').trim().toLowerCase();
    const project = state.projects.find((item) => item.id === task.projectId);
    if (projectFilter === 'none' && task.projectId) return false;
    if (projectFilter !== 'all' && projectFilter !== 'none' && task.projectId !== projectFilter) return false;
    if (includeStatusFilter && taskFilter === 'open' && task.done) return false;
    if (includeStatusFilter && taskFilter === 'today' && (task.done || task.due !== todayKey())) return false;
    if (includeStatusFilter && taskFilter === 'done' && !task.done) return false;
    if (query && !`${task.title} ${task.detail} ${task.category} ${project?.name || ''}`.toLowerCase().includes(query)) return false;
    return true;
  }

  function renderMissionTasks() {
    let tasks = sortedTasks(state.tasks.filter((task) => missionMatchesScope(task)), $('#taskSort')?.value || 'priority');
    $('#missionTaskList').innerHTML = tasks.length
      ? tasks.map((task) => taskMarkup(task, true)).join('')
      : '<div class="panel empty-state"><div><strong>該当するミッションはありません</strong><span>検索やフィルターを変更してみてください。</span></div></div>';

    const scoped = state.tasks.filter((task) => missionMatchesScope(task, { includeStatusFilter: false }));
    const open = scoped.filter((task) => !task.done).length;
    const todayCount = scoped.filter((task) => !task.done && task.due === todayKey()).length;
    const high = scoped.filter((task) => !task.done && task.priority === 'high').length;
    const done = scoped.filter((task) => task.done).length;
    $('#missionSummary').innerHTML = [
      [open, 'ACTIVE'], [todayCount, 'DUE TODAY'], [high, 'HIGH PRIORITY'], [done, 'COMPLETED']
    ].map(([value, label]) => `<div class="summary-chip"><strong>${value}</strong><span>${label}</span></div>`).join('');
    renderMissionBoard(scoped);
  }

  function renderMissionBoard(tasks) {
    const columns = [
      ['backlog', 'BACKLOG'],
      ['next', 'NEXT ACTIONS'],
      ['waiting', 'WAITING'],
      ['done', 'COMPLETE']
    ];
    $('#missionBoard').innerHTML = columns.map(([status, label]) => {
      const columnTasks = sortedTasks(tasks.filter((task) => (task.status || (task.done ? 'done' : 'next')) === status));
      return `<section class="board-column" data-board-status="${status}"><header class="board-column-head"><span>${label}</span><b>${columnTasks.length}</b></header><div class="board-stack">${columnTasks.map(boardCardMarkup).join('') || '<div class="board-empty">ここへミッションをドロップ</div>'}</div></section>`;
    }).join('');
  }

  function boardCardMarkup(task) {
    const project = state.projects.find((item) => item.id === task.projectId);
    const color = projectColors[project?.color] || '#777382';
    const statuses = ['backlog', 'next', 'waiting', 'done'];
    const index = statuses.indexOf(task.status || (task.done ? 'done' : 'next'));
    return `<article class="board-card" draggable="true" data-board-task-id="${escapeHtml(task.id)}" style="--project-color:${color}"><h3>${escapeHtml(task.title)}</h3><div class="board-card-meta"><span>${escapeHtml(project?.name || 'NO PROJECT')}</span><span>${escapeHtml(formatDue(task.due) || '期限なし')}</span><span>${Number(task.estimatedMinutes || 25)} MIN</span></div><div class="board-card-actions"><button type="button" data-board-action="previous" aria-label="前の状態へ" ${index <= 0 ? 'disabled' : ''}>←</button><button type="button" data-board-action="next" aria-label="次の状態へ" ${index >= statuses.length - 1 ? 'disabled' : ''}>→</button><button type="button" data-board-action="edit">編集</button>${task.done ? '' : '<button type="button" data-board-action="focus">集中</button>'}</div></article>`;
  }

  function toggleMissionMode() {
    missionMode = missionMode === 'list' ? 'board' : 'list';
    $('#missionsView').classList.toggle('board-mode', missionMode === 'board');
    $('#missionViewButton').textContent = missionMode === 'board' ? 'リスト表示' : 'ボード表示';
    renderMissionTasks();
  }

  function setTaskStatus(task, status, { render = true } = {}) {
    if (!['backlog', 'next', 'waiting', 'done'].includes(status)) return;
    const wasDone = Boolean(task.done);
    task.status = status;
    task.done = status === 'done';
    task.completedAt = task.done ? (task.completedAt || new Date().toISOString()) : null;
    if (!wasDone && task.done) {
      const next = createNextRecurringTask(task);
      if (next) setTimeout(() => showToast('NEXT MISSION SCHEDULED', `${formatDue(next.due)} · ${next.title}`), 350);
      checkAchievements();
    }
    if (render) { renderTasks(); renderPlanner(); renderStats(); scheduleSave(100); }
  }

  function handleBoardClick(event) {
    const button = event.target.closest('[data-board-action]');
    const card = event.target.closest('[data-board-task-id]');
    if (!button || !card) return;
    const task = state.tasks.find((item) => item.id === card.dataset.boardTaskId);
    if (!task) return;
    const action = button.dataset.boardAction;
    if (action === 'edit') { openTaskModal(task); return; }
    if (action === 'focus') {
      $('#focusTaskSelect').value = task.id; focus.taskId = task.id; navigate('focus'); updateFocusDisplay(); persistFocusRuntime(); return;
    }
    const statuses = ['backlog', 'next', 'waiting', 'done'];
    const index = statuses.indexOf(task.status || (task.done ? 'done' : 'next'));
    const destination = action === 'previous' ? statuses[index - 1] : statuses[index + 1];
    if (destination) { setTaskStatus(task, destination); showToast('MISSION STATE UPDATED', `${task.title} · ${destination.toUpperCase()}`); }
  }

  function handleBoardDragStart(event) {
    const card = event.target.closest('[data-board-task-id]');
    if (!card) return;
    draggedTaskId = card.dataset.boardTaskId;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedTaskId);
  }

  function handleBoardDragEnd() {
    draggedTaskId = null;
    $$('.board-card.dragging').forEach((card) => card.classList.remove('dragging'));
    $$('.board-column.drag-over').forEach((column) => column.classList.remove('drag-over'));
  }

  function handleBoardDragOver(event) {
    const column = event.target.closest('[data-board-status]');
    if (!column || !draggedTaskId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    $$('.board-column.drag-over').forEach((item) => item.classList.toggle('drag-over', item === column));
  }

  function handleBoardDragLeave(event) {
    const column = event.target.closest('[data-board-status]');
    if (column && !column.contains(event.relatedTarget)) column.classList.remove('drag-over');
  }

  function handleBoardDrop(event) {
    const column = event.target.closest('[data-board-status]');
    if (!column) return;
    event.preventDefault();
    const taskId = draggedTaskId || event.dataTransfer.getData('text/plain');
    const task = state.tasks.find((item) => item.id === taskId);
    if (task) { setTaskStatus(task, column.dataset.boardStatus); showToast('MISSION MOVED', `${task.title} · ${column.dataset.boardStatus.toUpperCase()}`); }
    handleBoardDragEnd();
  }

  function handleProjectStripClick(event) {
    const edit = event.target.closest('[data-project-edit]');
    if (edit) { openProjectModal(state.projects.find((project) => project.id === edit.dataset.projectEdit)); return; }
    const card = event.target.closest('[data-project-filter]');
    if (!card) return;
    projectFilter = card.dataset.projectFilter;
    renderProjectControls();
    renderProjectStrip();
    renderMissionTasks();
  }

  function openProjectModal(project = null) {
    $('#projectForm').reset();
    $('#projectModalTitle').textContent = project ? 'プロジェクトを編集' : 'プロジェクトを追加';
    $('#projectId').value = project?.id || '';
    $('#projectName').value = project?.name || '';
    $('#projectDescription').value = project?.description || '';
    $('#projectColor').value = project?.color || 'violet';
    $('#projectDeleteButton').hidden = !project;
    $('#projectModal').classList.add('open');
    $('#projectModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#projectName').focus(), 40);
  }

  function closeProjectModal() {
    $('#projectModal').classList.remove('open');
    $('#projectModal').setAttribute('aria-hidden', 'true');
  }

  function saveProjectFromForm(event) {
    event.preventDefault();
    const name = $('#projectName').value.trim();
    if (!name) return;
    const existing = state.projects.find((project) => project.id === $('#projectId').value);
    if (!existing && state.projects.length >= 50) { showToast('PROJECT LIMIT', 'プロジェクトは最大50件まで作成できます。'); return; }
    const values = { name: name.slice(0, 80), description: $('#projectDescription').value.trim().slice(0, 240), color: $('#projectColor').value };
    if (existing) Object.assign(existing, values);
    else state.projects.push({ id: uid(), ...values, archived: false, createdAt: new Date().toISOString() });
    closeProjectModal(); renderTasks(); scheduleSave(100);
    showToast(existing ? 'PROJECT UPDATED' : 'PROJECT CREATED', name);
  }

  function deleteProjectFromForm() {
    const project = state.projects.find((item) => item.id === $('#projectId').value);
    if (!project) return;
    const index = state.projects.indexOf(project);
    const assignments = state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id);
    state.projects.splice(index, 1);
    state.tasks.forEach((task) => { if (task.projectId === project.id) task.projectId = null; });
    projectFilter = 'all';
    closeProjectModal(); renderTasks(); scheduleSave(100);
    showToast('PROJECT REMOVED', `${project.name}（ミッションは保持されています）`, {
      actionLabel: '元に戻す',
      onAction: () => { state.projects.splice(index, 0, project); state.tasks.forEach((task) => { if (assignments.includes(task.id)) task.projectId = project.id; }); renderTasks(); scheduleSave(100); },
      actionToastTitle: 'PROJECT RESTORED', actionToastMessage: `${project.name}を復元しました。`
    });
  }

  function handleTaskListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    const row = event.target.closest('[data-task-id]');
    if (!actionButton || !row) return;
    const task = state.tasks.find((item) => item.id === row.dataset.taskId);
    if (!task) return;

    if (actionButton.dataset.action === 'subtask-toggle') {
      const subtask = (task.subtasks || []).find((item) => item.id === actionButton.dataset.subtaskId);
      if (!subtask) return;
      subtask.done = !subtask.done;
      renderTasks();
      scheduleSave(100);
      showToast(subtask.done ? 'CHECKPOINT COMPLETE' : 'CHECKPOINT REOPENED', subtask.title);
      return;
    }

    if (actionButton.dataset.action === 'snooze') {
      const previousDue = task.due || '';
      const baseDate = parseLocalDate(task.due && task.due > todayKey() ? task.due : todayKey());
      baseDate.setDate(baseDate.getDate() + 1);
      task.due = todayKey(baseDate);
      renderTasks();
      renderPlanner();
      scheduleSave(100);
      showToast('MISSION SHIFTED', `${formatDue(task.due)}へ延期しました。`, {
        actionLabel: '元に戻す',
        onAction: () => { task.due = previousDue; renderTasks(); renderPlanner(); scheduleSave(100); },
        actionToastTitle: 'SHIFT UNDONE',
        actionToastMessage: '元の期限へ戻しました。'
      });
      return;
    }

    if (actionButton.dataset.action === 'toggle') {
      const completing = !task.done;
      setTaskStatus(task, completing ? 'done' : 'next');
      if (completing) showToast('MISSION COMPLETE', task.title);
    }
    if (actionButton.dataset.action === 'edit') openTaskModal(task);
    if (actionButton.dataset.action === 'focus') {
      $('#focusTaskSelect').value = task.id;
      focus.taskId = task.id;
      navigate('focus');
      updateFocusDisplay();
      persistFocusRuntime();
      showToast('FOCUS TARGET LOCKED', task.title);
    }
    if (actionButton.dataset.action === 'delete') {
      const index = state.tasks.indexOf(task);
      state.tasks.splice(index, 1);
      renderTasks(); renderPlanner(); renderStats(); scheduleSave(100);
      showToast('MISSION REMOVED', task.title, { actionLabel: '元に戻す', onAction: () => { state.tasks.splice(index, 0, task); renderTasks(); renderPlanner(); renderStats(); scheduleSave(100); } });
    }
  }

  function openTaskModal(task = null) {
    $('#taskForm').reset();
    renderProjectControls();
    $('#taskModalTitle').textContent = task ? 'ミッションを編集' : 'ミッションを追加';
    $('#taskId').value = task?.id || '';
    $('#taskTitle').value = task?.title || '';
    $('#taskDetail').value = task?.detail || '';
    $('#taskPriority').value = task?.priority || 'medium';
    $('#taskCategory').value = task?.category || 'WORK';
    $('#taskDue').value = task?.due || todayKey();
    $('#taskRecurrence').value = task?.recurrence || 'none';
    $('#taskEstimate').value = String(task?.estimatedMinutes || 25);
    $('#taskProject').value = task?.projectId || '';
    $('#taskStatus').value = task?.status || (task?.done ? 'done' : 'next');
    editingSubtasks = (task?.subtasks || []).map((subtask) => ({ ...subtask }));
    renderDraftSubtasks();
    $('#taskModal').classList.add('open');
    $('#taskModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#taskTitle').focus(), 50);
  }

  function closeTaskModal() {
    $('#taskModal').classList.remove('open');
    $('#taskModal').setAttribute('aria-hidden', 'true');
  }

  function saveTaskFromForm(event) {
    event.preventDefault();
    const title = $('#taskTitle').value.trim();
    if (!title) return;
    const id = $('#taskId').value;
    const existing = state.tasks.find((task) => task.id === id);
    const values = {
      title,
      detail: $('#taskDetail').value.trim(),
      priority: $('#taskPriority').value,
      category: $('#taskCategory').value,
      due: $('#taskDue').value,
      recurrence: $('#taskRecurrence').value,
      estimatedMinutes: Number($('#taskEstimate').value),
      projectId: $('#taskProject').value || null,
      subtasks: editingSubtasks.map((subtask) => ({ ...subtask }))
    };
    const status = $('#taskStatus').value;
    if (existing) { Object.assign(existing, values); setTaskStatus(existing, status, { render: false }); }
    else state.tasks.unshift({ id: uid(), ...values, status, seriesId: values.recurrence === 'none' ? null : uid(), done: status === 'done', createdAt: new Date().toISOString(), completedAt: status === 'done' ? new Date().toISOString() : null });
    closeTaskModal();
    renderTasks();
    renderPlanner();
    renderStats();
    scheduleSave(100);
    showToast(existing ? 'MISSION UPDATED' : 'MISSION CREATED', title);
  }

  function addDraftSubtask() {
    const input = $('#subtaskInput');
    const title = input.value.trim();
    if (!title || editingSubtasks.length >= 50) return;
    editingSubtasks.push({ id: uid(), title: title.slice(0, 120), done: false });
    input.value = '';
    renderDraftSubtasks();
    input.focus();
  }

  function renderDraftSubtasks() {
    $('#subtaskDraftList').innerHTML = editingSubtasks.map((subtask) => `<div class="subtask-draft ${subtask.done ? 'done' : ''}" data-draft-id="${escapeHtml(subtask.id)}"><button type="button" class="draft-check" data-draft-action="toggle" aria-label="完了を切り替える"></button><span>${escapeHtml(subtask.title)}</span><button type="button" data-draft-action="remove" aria-label="削除">×</button></div>`).join('');
  }

  function handleDraftSubtaskClick(event) {
    const row = event.target.closest('[data-draft-id]');
    const action = event.target.closest('[data-draft-action]')?.dataset.draftAction;
    if (!row || !action) return;
    const subtask = editingSubtasks.find((item) => item.id === row.dataset.draftId);
    if (!subtask) return;
    if (action === 'toggle') subtask.done = !subtask.done;
    if (action === 'remove') editingSubtasks = editingSubtasks.filter((item) => item.id !== subtask.id);
    renderDraftSubtasks();
  }

  function createNextRecurringTask(task) {
    if (!task.recurrence || task.recurrence === 'none') return null;
    const seriesId = task.seriesId || uid();
    task.seriesId = seriesId;
    const baseDate = parseLocalDate(task.due || todayKey());
    if (task.recurrence === 'weekly') baseDate.setDate(baseDate.getDate() + 7);
    else {
      baseDate.setDate(baseDate.getDate() + 1);
      if (task.recurrence === 'weekdays') {
        while (baseDate.getDay() === 0 || baseDate.getDay() === 6) baseDate.setDate(baseDate.getDate() + 1);
      }
    }
    const due = todayKey(baseDate);
    const duplicate = state.tasks.find((candidate) => !candidate.done && candidate.seriesId === seriesId && candidate.due === due);
    if (duplicate) return null;
    const next = {
      ...task,
      id: uid(),
      due,
      done: false,
      status: 'next',
      completedAt: null,
      createdAt: new Date().toISOString(),
      seriesId,
      subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask, id: uid(), done: false }))
    };
    state.tasks.push(next);
    return next;
  }

  function formatDue(dateValue) {
    if (!dateValue) return '';
    const today = todayKey();
    if (dateValue === today) return '今日';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateValue === todayKey(tomorrow)) return '明日';
    const [year, month, day] = dateValue.split('-').map(Number);
    if (!year) return '';
    return `${month}/${day}`;
  }

  function parseLocalDate(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  }

  function shiftPlannerDate(amount) {
    const date = parseLocalDate(plannerDate);
    if (plannerMode === 'month') { date.setDate(1); date.setMonth(date.getMonth() + amount); }
    else if (plannerMode === 'week') date.setDate(date.getDate() + amount * 7);
    else date.setDate(date.getDate() + amount);
    plannerDate = todayKey(date);
    renderPlanner();
  }

  function plannerWeekDates() {
    const date = parseLocalDate(plannerDate);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return Array.from({ length: 7 }, (_value, index) => {
      const cursor = new Date(date);
      cursor.setDate(cursor.getDate() + index);
      return todayKey(cursor);
    });
  }

  function renderPlanner() {
    const date = parseLocalDate(plannerDate);
    $('#plannerView').classList.toggle('month-mode', plannerMode === 'month');
    $('#plannerView').classList.toggle('week-mode', plannerMode === 'week');
    $$('#plannerModeSwitch [data-planner-mode]').forEach((button) => button.classList.toggle('active', button.dataset.plannerMode === plannerMode));
    const week = plannerWeekDates();
    const weekEnd = parseLocalDate(week[6]);
    const localizedWeekday = i18n?.formatDate(date, { weekday: 'long' }) || date.toLocaleDateString('ja-JP', { weekday: 'long' });
    $('#plannerWeekday').textContent = plannerMode === 'month' ? 'MONTH OVERVIEW' : plannerMode === 'week' ? 'WEEKLY COCKPIT' : `${localizedWeekday}${plannerDate === todayKey() ? ` · ${tr('今日').toUpperCase()}` : ''}`;
    $('#plannerDateLabel').textContent = plannerMode === 'month'
      ? (i18n?.formatDate(date, { year: 'numeric', month: 'long' }) || date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' }))
      : plannerMode === 'week'
        ? `${i18n?.formatDate(parseLocalDate(week[0]), { month: 'short', day: 'numeric' }) || week[0].replaceAll('-', '/')} — ${i18n?.formatDate(weekEnd, { month: 'short', day: 'numeric' }) || `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`}`
        : (i18n?.formatDate(date, { year: 'numeric', month: 'long', day: 'numeric' }) || date.toLocaleDateString('ja-JP'));
    $('#plannerDateInput').value = plannerDate;

    const items = state.planItems.filter((item) => item.date === plannerDate).sort((a, b) => a.time.localeCompare(b.time));
    const conflictIds = new Set(planning.conflictIds(items, plannerDate));
    $('#planItemCount').textContent = `${items.length} BLOCK${items.length === 1 ? '' : 'S'}`;
    $('#dayPlanList').innerHTML = items.length ? items.map((item) => {
      const task = state.tasks.find((candidate) => candidate.id === item.taskId);
      const hasConflict = conflictIds.has(item.id);
      return `<div class="plan-block ${item.done ? 'done' : ''} ${item.autoPlanned ? 'auto-planned' : ''} ${hasConflict ? 'conflict' : ''}" data-plan-id="${escapeHtml(item.id)}">
        <div class="plan-time"><span>${escapeHtml(item.time)}</span><small>${Number(item.duration)} MIN</small></div>
        <div class="plan-main"><p class="plan-title">${escapeHtml(item.title)}${hasConflict ? '<span class="plan-status warning">CONFLICT</span>' : item.autoPlanned ? '<span class="plan-status">AUTO</span>' : ''}</p><p class="plan-link">${task ? `MISSION · ${escapeHtml(task.title)}` : item.done ? 'COMPLETED' : 'OPEN TIME BLOCK'}${Number(item.reminderMinutes) >= 0 ? ` · ◇ ${Number(item.reminderMinutes) ? `${Number(item.reminderMinutes)}分前通知` : '開始時通知'}` : ''}</p></div>
        <div class="plan-actions">
          <button type="button" data-plan-action="toggle" aria-label="完了を切り替える"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></button>
          <button type="button" data-plan-action="focus" aria-label="集中する"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2"/></svg></button>
          <button type="button" data-plan-action="edit" aria-label="編集"><svg viewBox="0 0 24 24"><path d="m14 5 5 5L9 20H4v-5z"/></svg></button>
          <button type="button" data-plan-action="delete" class="danger" aria-label="削除"><svg viewBox="0 0 24 24"><path d="M5 7h14M8 7l1 14h6l1-14M9 7V4h6v3"/></svg></button>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state"><div><strong>自由な軌道です</strong><span>時間ブロックを置いて、一日に輪郭をつくりましょう。</span></div></div>';

    renderHabits();
    renderPlannerProgress(items);
    renderPlannerAssist(items, conflictIds);
    renderPlanTaskOptions();
    renderMonthCalendar();
    renderWeekPlanner();
  }

  function renderPlannerAssist(items, conflictIds) {
    const active = items.filter((item) => !item.done);
    const scheduledMinutes = active.reduce((total, item) => total + Number(item.duration || 0), 0);
    const linked = new Set(items.filter((item) => item.taskId).map((item) => item.taskId));
    const unscheduled = state.tasks.filter((task) => !task.done && !linked.has(task.id)).length;
    const openMinutes = Math.max(0, 13 * 60 - scheduledMinutes);
    const conflictCount = conflictIds.size;
    const assist = $('#plannerAssist');
    assist.classList.toggle('conflict', conflictCount > 0);
    $('#autoPlanButton').disabled = plannerDate < todayKey();
    if (conflictCount) {
      $('#plannerAssistTitle').textContent = `${conflictCount}件の時間ブロックが重複しています`;
      $('#plannerAssistCopy').textContent = 'CONFLICT表示の開始時刻か長さを調整してください。';
    } else if (unscheduled) {
      $('#plannerAssistTitle').textContent = `${unscheduled}件の未配置ミッションがあります`;
      $('#plannerAssistCopy').textContent = '優先度・期限・所要時間を使い、最大3件を空き枠へ配置できます。';
    } else {
      $('#plannerAssistTitle').textContent = '今日の軌道は整理されています';
      $('#plannerAssistCopy').textContent = 'すべての進行中ミッションに時間の居場所があります。';
    }
    $('#plannerAssistMetrics').innerHTML = `<span>${scheduledMinutes} MIN PLANNED</span><span>${openMinutes} MIN OPEN</span>`;
  }

  function autoPlanDay() {
    if (plannerDate < todayKey()) {
      showToast('PAST ORBIT LOCKED', '過去の日付には自動配置できません。');
      return;
    }
    let startMinute = 9 * 60;
    if (plannerDate === todayKey()) {
      const now = new Date();
      startMinute = Math.max(startMinute, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
    }
    const proposals = planning.autoPlan({ tasks: state.tasks, planItems: state.planItems, date: plannerDate, startMinute, endMinute: 22 * 60, maxItems: 3 });
    if (!proposals.length) {
      showToast('ORBIT ALREADY FULL', '配置できる未登録ミッション、または十分な空き時間がありません。');
      return;
    }
    const createdAt = new Date().toISOString();
    const generated = proposals.map((proposal) => ({ id: uid(), ...proposal, date: plannerDate, reminderMinutes: -1, reminderSentAt: null, autoPlanned: true, done: false, createdAt }));
    state.planItems.push(...generated);
    renderPlanner();
    scheduleSave(100);
    const generatedIds = new Set(generated.map((item) => item.id));
    showToast('ORBIT GENERATED', `${generated.length}件のミッションを空き時間へ配置しました。`, {
      actionLabel: '元に戻す',
      onAction: () => { state.planItems = state.planItems.filter((item) => !generatedIds.has(item.id)); renderPlanner(); scheduleSave(100); },
      actionToastTitle: 'AUTO PLAN UNDONE',
      actionToastMessage: '自動配置前の予定へ戻しました。'
    });
  }

  function renderMonthCalendar() {
    const selected = parseLocalDate(plannerDate);
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    const weekday = first.getDay() || 7;
    first.setDate(first.getDate() - weekday + 1);
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(first); date.setDate(first.getDate() + index);
      const key = todayKey(date);
      const planCount = state.planItems.filter((item) => item.date === key && !item.done).length;
      const taskCount = state.tasks.filter((task) => task.due === key && !task.done).length;
      const ritualCount = state.habits.filter((habit) => habit.completions.includes(key)).length;
      const dotCount = Math.min(3, planCount + taskCount + ritualCount);
      const classes = [date.getMonth() !== selected.getMonth() ? 'other-month' : '', key === plannerDate ? 'selected' : '', key === todayKey() ? 'today' : ''].filter(Boolean).join(' ');
      cells.push(`<button type="button" class="month-cell ${classes}" data-month-date="${key}"><span class="month-number">${date.getDate()}</span><span class="month-dots">${Array.from({ length: dotCount }, () => '<i></i>').join('')}</span><span class="month-metrics">${planCount ? `<span><b>${planCount}</b>予定</span>` : ''}${taskCount ? `<span><b>${taskCount}</b>ミッション</span>` : ''}${ritualCount ? `<span><b>${ritualCount}</b>習慣達成</span>` : ''}</span></button>`);
    }
    $('#monthGrid').innerHTML = cells.join('');
  }

  function renderWeekPlanner() {
    const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    $('#weekGrid').innerHTML = plannerWeekDates().map((key, index) => {
      const date = parseLocalDate(key);
      const items = state.planItems.filter((item) => item.date === key && !item.done).sort((a, b) => a.time.localeCompare(b.time));
      const dueTasks = state.tasks.filter((task) => !task.done && task.due === key);
      const minutes = items.reduce((total, item) => total + Number(item.duration || 0), 0);
      const load = Math.min(100, Math.round((minutes / 480) * 100));
      return `<section class="week-day ${key === todayKey() ? 'today' : ''}"><button type="button" class="week-day-head" data-week-date="${key}"><span>${labels[index]}</span><strong>${date.getDate()}</strong></button><div class="week-day-load"><i style="--week-load:${load}%"></i></div><div class="week-blocks">${items.slice(0, 5).map((item) => `<div class="week-block"><b>${escapeHtml(item.time)}</b>${escapeHtml(item.title)}</div>`).join('') || '<div class="board-empty">OPEN ORBIT</div>'}</div>${dueTasks.length ? `<div class="week-due">◎ ${dueTasks.length} DUE</div>` : ''}</section>`;
    }).join('');
  }

  function renderPlannerProgress(items = state.planItems.filter((item) => item.date === plannerDate)) {
    const completedPlans = items.filter((item) => item.done).length;
    const completedHabits = state.habits.filter((habit) => habit.completions.includes(plannerDate)).length;
    const total = items.length + state.habits.length;
    const percentage = total ? Math.round(((completedPlans + completedHabits) / total) * 100) : 0;
    $('#plannerProgressBar').style.setProperty('--day-progress', `${percentage}%`);
    $('#plannerProgressText').textContent = `${percentage}%`;
    $('#daySummaryValue').textContent = `${percentage}%`;
    $('#daySummaryRing').style.setProperty('--day-angle', `${percentage * 3.6}deg`);
    $('#daySummaryCopy').textContent = percentage === 100 ? '今日の軌道をすべて完了しました。' : percentage >= 60 ? 'いい軌道です。あと少しだけ。' : percentage > 0 ? '小さな前進が記録されています。' : '最初の一歩を記録しましょう。';
  }

  function renderPlanTaskOptions() {
    const select = $('#planTask');
    const previous = select.value;
    select.innerHTML = `<option value="">関連付けない</option>${sortedTasks(state.tasks.filter((task) => !task.done)).map((task) => { const project = state.projects.find((item) => item.id === task.projectId); return `<option value="${escapeHtml(task.id)}">${project ? `${escapeHtml(project.name)} · ` : ''}${escapeHtml(task.title)}</option>`; }).join('')}`;
    if (state.tasks.some((task) => task.id === previous)) select.value = previous;
  }

  function openPlanModal(item = null) {
    $('#planForm').reset();
    renderPlanTaskOptions();
    $('#planModalTitle').textContent = item ? '予定を編集' : '予定を追加';
    $('#planId').value = item?.id || '';
    $('#planTitle').value = item?.title || '';
    $('#planDate').value = item?.date || plannerDate;
    $('#planTime').value = item?.time || nextPlanTime();
    $('#planDuration').value = String(item?.duration || 30);
    if (![...$('#planDuration').options].some((option) => option.value === String(item?.duration))) $('#planDuration').value = '30';
    $('#planTask').value = item?.taskId || '';
    $('#planReminder').value = String(item?.reminderMinutes ?? -1);
    $('#planModal').classList.add('open');
    $('#planModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#planTitle').focus(), 40);
  }

  function closePlanModal() {
    $('#planModal').classList.remove('open');
    $('#planModal').setAttribute('aria-hidden', 'true');
  }

  function nextPlanTime() {
    const sameDay = state.planItems.filter((item) => item.date === plannerDate).sort((a, b) => b.time.localeCompare(a.time));
    if (!sameDay.length) {
      const now = new Date();
      if (plannerDate !== todayKey()) return '09:00';
      const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
      now.setMinutes(roundedMinutes, 0, 0);
      return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
    const latest = sameDay[0];
    const [hour, minute] = latest.time.split(':').map(Number);
    const totalMinutes = Math.min(23 * 60 + 45, hour * 60 + minute + Number(latest.duration || 30));
    return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
  }

  function savePlanFromForm(event) {
    event.preventDefault();
    const title = $('#planTitle').value.trim();
    if (!title) return;
    const id = $('#planId').value;
    const existing = state.planItems.find((item) => item.id === id);
    const values = { title, date: $('#planDate').value, time: $('#planTime').value, duration: Number($('#planDuration').value), taskId: $('#planTask').value || null, reminderMinutes: Number($('#planReminder').value) };
    const savedItem = existing || { id: uid(), done: false, createdAt: new Date().toISOString() };
    Object.assign(savedItem, values, { reminderSentAt: null, autoPlanned: false });
    if (!existing) state.planItems.push(savedItem);
    plannerDate = values.date;
    closePlanModal();
    renderPlanner();
    scheduleSave(100);
    const hasConflict = planning.conflictIds(state.planItems, values.date).includes(savedItem.id);
    showToast(hasConflict ? 'SCHEDULE CONFLICT' : existing ? 'TIME BLOCK UPDATED' : 'TIME BLOCK CREATED', hasConflict ? `${values.time}は別の予定と重なっています。` : `${values.time} · ${title}`);
  }

  function handlePlanClick(event) {
    const button = event.target.closest('[data-plan-action]');
    const row = event.target.closest('[data-plan-id]');
    if (!button || !row) return;
    const item = state.planItems.find((candidate) => candidate.id === row.dataset.planId);
    if (!item) return;
    const action = button.dataset.planAction;
    if (action === 'toggle') { item.done = !item.done; renderPlanner(); scheduleSave(100); if (item.done) showToast('TIME BLOCK COMPLETE', item.title); }
    if (action === 'edit') openPlanModal(item);
    if (action === 'focus') {
      if (item.taskId && state.tasks.some((task) => task.id === item.taskId && !task.done)) $('#focusTaskSelect').value = item.taskId;
      focus.taskId = $('#focusTaskSelect').value || null;
      navigate('focus');
      persistFocusRuntime();
      showToast('FOCUS FROM PLAN', item.title);
    }
    if (action === 'delete') {
      const index = state.planItems.indexOf(item);
      state.planItems.splice(index, 1);
      renderPlanner(); scheduleSave(100);
      showToast('TIME BLOCK REMOVED', item.title, { actionLabel: '元に戻す', onAction: () => { state.planItems.splice(index, 0, item); renderPlanner(); scheduleSave(100); } });
    }
  }

  function checkPlanReminders(now) {
    const minuteKey = `${todayKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (minuteKey === lastReminderMinute) return;
    lastReminderMinute = minuteKey;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const due = state.planItems.filter((item) => {
      if (item.done || item.date !== todayKey(now) || Number(item.reminderMinutes) < 0 || item.reminderSentAt) return false;
      const [hour, minute] = item.time.split(':').map(Number);
      const trigger = hour * 60 + minute - Number(item.reminderMinutes);
      return trigger <= nowMinutes && nowMinutes - trigger <= 10;
    });
    due.forEach((item) => {
      item.reminderSentAt = now.toISOString();
      if (state.settings.notifications) {
        window.asteria.notify(`ASTERIA — ${item.title}`, tr(Number(item.reminderMinutes) ? `${item.reminderMinutes}分後に予定が始まります。` : '予定の開始時刻です。'));
      }
      showToast('SCHEDULE SIGNAL', `${item.time} · ${item.title}`);
    });
    if (due.length) scheduleSave(50);
  }

  function habitColor(color) {
    return { violet: '#9b7cff', cyan: '#48d5da', amber: '#f7b55f', green: '#55e6ad' }[color] || '#9b7cff';
  }

  function habitStreak(habit) {
    const dates = new Set(habit.completions);
    const cursor = parseLocalDate(plannerDate > todayKey() ? todayKey() : plannerDate);
    if (!dates.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (dates.has(todayKey(cursor)) && streak < 730) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }

  function renderHabits() {
    const week = plannerWeekDates();
    $('#habitList').innerHTML = state.habits.length ? state.habits.map((habit) => {
      const color = habitColor(habit.color);
      const weekCount = week.filter((date) => habit.completions.includes(date)).length;
      return `<div class="habit-row" data-habit-id="${escapeHtml(habit.id)}" style="--habit-color:${color}">
        <div class="habit-info"><strong>${escapeHtml(habit.name)}</strong><span><i class="habit-color"></i>${weekCount}/${habit.target} · ${habitStreak(habit)} DAY STREAK</span></div>
        ${week.map((date) => `<button type="button" class="habit-day ${habit.completions.includes(date) ? 'checked' : ''}" data-habit-date="${date}" aria-pressed="${habit.completions.includes(date)}" aria-label="${date}を切り替える"></button>`).join('')}
        <div class="habit-menu"><button type="button" data-habit-action="edit">編集</button><button type="button" data-habit-action="delete">削除</button></div>
      </div>`;
    }).join('') : '<div class="empty-state"><div><strong>習慣はまだありません</strong><span>右上の＋から、小さく続けたいことを追加できます。</span></div></div>';
  }

  function openHabitModal(habit = null) {
    $('#habitForm').reset();
    $('#habitModalTitle').textContent = habit ? '習慣を編集' : '習慣を追加';
    $('#habitId').value = habit?.id || '';
    $('#habitName').value = habit?.name || '';
    $('#habitTarget').value = String(habit?.target || 5);
    $('#habitColor').value = habit?.color || 'violet';
    $('#habitModal').classList.add('open');
    $('#habitModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#habitName').focus(), 40);
  }

  function closeHabitModal() {
    $('#habitModal').classList.remove('open');
    $('#habitModal').setAttribute('aria-hidden', 'true');
  }

  function saveHabitFromForm(event) {
    event.preventDefault();
    const name = $('#habitName').value.trim();
    if (!name) return;
    const existing = state.habits.find((habit) => habit.id === $('#habitId').value);
    const values = { name, target: Number($('#habitTarget').value), color: $('#habitColor').value };
    if (existing) Object.assign(existing, values);
    else state.habits.push({ id: uid(), ...values, completions: [] });
    closeHabitModal(); renderPlanner(); scheduleSave(100);
    showToast(existing ? 'RITUAL UPDATED' : 'RITUAL CREATED', name);
  }

  function handleHabitClick(event) {
    const row = event.target.closest('[data-habit-id]');
    if (!row) return;
    const habit = state.habits.find((candidate) => candidate.id === row.dataset.habitId);
    if (!habit) return;
    const day = event.target.closest('[data-habit-date]');
    if (day) {
      const date = day.dataset.habitDate;
      if (habit.completions.includes(date)) habit.completions = habit.completions.filter((item) => item !== date);
      else habit.completions.push(date);
      renderPlanner(); renderStats(); scheduleSave(100);
      return;
    }
    const action = event.target.closest('[data-habit-action]')?.dataset.habitAction;
    if (action === 'edit') openHabitModal(habit);
    if (action === 'delete') {
      const index = state.habits.indexOf(habit);
      state.habits.splice(index, 1); renderPlanner(); scheduleSave(100);
      showToast('RITUAL REMOVED', habit.name, { actionLabel: '元に戻す', onAction: () => { state.habits.splice(index, 0, habit); renderPlanner(); scheduleSave(100); } });
    }
  }

  function updateNotes(value, sourceSelector) {
    state.notes = value;
    const other = sourceSelector === '#fullNotes' ? $('#dashboardNotes') : $('#fullNotes');
    if (other.value !== value) other.value = value;
    renderNoteMeta();
    renderNotePreview();
    scheduleSave();
  }

  function renderNotes() {
    $('#dashboardNotes').value = state.notes || '';
    $('#fullNotes').value = state.notes || '';
    renderNoteMeta();
    renderNotePreview();
  }

  function renderNoteMeta() {
    const text = state.notes || '';
    const localizedLength = i18n?.formatNumber(text.length) || text.length.toLocaleString('ja-JP');
    const lineCount = text ? text.split('\n').length : 0;
    const localizedLines = i18n?.formatNumber(lineCount) || lineCount.toLocaleString('ja-JP');
    $('#noteCount').textContent = `${localizedLength}文字`;
    $('#fullNoteStats').textContent = `${localizedLength}文字 · ${localizedLines}行`;
  }

  function renderNotePreview() {
    const lines = String(state.notes || '').split('\n');
    let html = '';
    let listOpen = false;
    const closeList = () => { if (listOpen) { html += '</ul>'; listOpen = false; } };
    for (const raw of lines) {
      const line = escapeHtml(raw);
      if (line.startsWith('### ')) { closeList(); html += `<h3>${inlineMarkdown(line.slice(4))}</h3>`; }
      else if (line.startsWith('## ')) { closeList(); html += `<h2>${inlineMarkdown(line.slice(3))}</h2>`; }
      else if (line.startsWith('# ')) { closeList(); html += `<h1>${inlineMarkdown(line.slice(2))}</h1>`; }
      else if (/^- \[[ xX]\] /.test(line)) {
        closeList();
        const checked = /^- \[[xX]\]/.test(line);
        html += `<p class="check-line"><i class="fake-check ${checked ? 'checked' : ''}"></i>${inlineMarkdown(line.slice(6))}</p>`;
      }
      else if (line.startsWith('- ')) {
        if (!listOpen) { html += '<ul>'; listOpen = true; }
        html += `<li>${inlineMarkdown(line.slice(2))}</li>`;
      }
      else if (line.startsWith('&gt; ')) { closeList(); html += `<blockquote>${inlineMarkdown(line.slice(5))}</blockquote>`; }
      else { closeList(); html += line ? `<p>${inlineMarkdown(line)}</p>` : '<p><br></p>'; }
    }
    closeList();
    $('#notePreview').innerHTML = html || '<p>プレビューがここに表示されます。</p>';
  }

  function inlineMarkdown(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  function insertMarkdown(template) {
    const textarea = $('#fullNotes');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const [before, after = ''] = template.split('|');
    const replacement = `${before}${selected}${after}`;
    textarea.setRangeText(replacement, start, end, 'end');
    updateNotes(textarea.value, '#fullNotes');
    textarea.focus();
  }

  function renderFocusTaskOptions() {
    const select = $('#focusTaskSelect');
    const previous = select.value;
    const options = sortedTasks(state.tasks.filter((task) => !task.done)).map((task) => { const project = state.projects.find((item) => item.id === task.projectId); return `<option value="${escapeHtml(task.id)}">${project ? `${escapeHtml(project.name)} · ` : ''}${escapeHtml(task.title)}</option>`; }).join('');
    select.innerHTML = `<option value="">ミッションを選択（任意）</option>${options}`;
    if (state.tasks.some((task) => task.id === previous && !task.done)) select.value = previous;
  }

  function toggleFocus() {
    if (focus.running) pauseFocus();
    else startFocus();
  }

  function startFocus() {
    focus.running = true;
    focus.endAt = Date.now() + focus.remaining * 1000;
    if (focus.phase === 'focus' && !focus.startedAt) focus.startedAt = new Date().toISOString();
    clearInterval(focus.interval);
    focus.interval = setInterval(tickFocus, 250);
    audioEngine.softStartIfEnabled();
    updateFocusDisplay();
    persistFocusRuntime();
  }

  function pauseFocus() {
    focus.remaining = Math.max(0, Math.ceil((focus.endAt - Date.now()) / 1000));
    focus.running = false;
    clearInterval(focus.interval);
    updateFocusDisplay();
    persistFocusRuntime();
  }

  function tickFocus() {
    focus.remaining = Math.max(0, Math.ceil((focus.endAt - Date.now()) / 1000));
    updateFocusDisplay();
    if (focus.remaining <= 0) completeFocusPhase();
  }

  function completeFocusPhase(restored = false) {
    focus.running = false;
    clearInterval(focus.interval);
    if (focus.phase === 'focus') {
      const selectedTask = state.tasks.find((task) => task.id === $('#focusTaskSelect').value);
      const completedAt = restored && focus.endAt ? new Date(focus.endAt).toISOString() : new Date().toISOString();
      state.focusSessions.push({
        id: uid(),
        startedAt: focus.startedAt || new Date(Date.now() - focus.total * 1000).toISOString(),
        completedAt,
        duration: Math.round(focus.total / 60),
        taskId: selectedTask?.id || null,
        taskTitle: selectedTask?.title || '自由集中',
        projectId: selectedTask?.projectId || null,
        completed: true
      });
      showToast('FOCUS COMPLETE', `${Math.round(focus.total / 60)}分の集中を記録しました。`);
      if (state.settings.notifications) window.asteria.notify('ASTERIA — Focus complete', tr('集中セッションが完了しました。少し休みましょう。'));
      checkAchievements();
      focus.phase = 'break';
      focus.total = focus.breakMinutes * 60;
      focus.remaining = focus.total;
      focus.startedAt = null;
      renderFocusSessions();
      renderStats();
    } else {
      showToast('BREAK COMPLETE', '次の集中軌道へ戻る準備ができました。');
      if (state.settings.notifications) window.asteria.notify('ASTERIA — Break complete', tr('休憩が終わりました。次のセッションを始められます。'));
      focus.phase = 'focus';
      focus.total = focus.minutes * 60;
      focus.remaining = focus.total;
    }
    updateFocusDisplay();
    persistFocusRuntime(100);
  }

  function skipFocusPhase() {
    if (focus.phase === 'focus' && focus.remaining < focus.total && !confirm('現在の集中セッションを記録せずに終了しますか？')) return;
    focus.running = false;
    clearInterval(focus.interval);
    focus.phase = focus.phase === 'focus' ? 'break' : 'focus';
    focus.total = (focus.phase === 'focus' ? focus.minutes : focus.breakMinutes) * 60;
    focus.remaining = focus.total;
    focus.startedAt = null;
    updateFocusDisplay();
    persistFocusRuntime();
  }

  function resetFocus() {
    focus.running = false;
    clearInterval(focus.interval);
    focus.total = (focus.phase === 'focus' ? focus.minutes : focus.breakMinutes) * 60;
    focus.remaining = focus.total;
    focus.startedAt = null;
    updateFocusDisplay();
    persistFocusRuntime();
  }

  function updateFocusDisplay() {
    const time = `${pad(Math.floor(focus.remaining / 60))}:${pad(focus.remaining % 60)}`;
    const progress = focus.total ? Math.min(100, ((focus.total - focus.remaining) / focus.total) * 100) : 0;
    const selectedTask = state?.tasks?.find((task) => task.id === $('#focusTaskSelect')?.value);
    const taskTitle = selectedTask?.title || 'ミッションを選択';
    $('#focusTimer').textContent = time;
    $('#dashboardTimer').textContent = time;
    $('#miniTimer').textContent = time;
    $('#focusPhase').textContent = focus.phase === 'focus' ? 'FOCUS' : 'RECOVERY';
    $('#focusStatus').textContent = focus.running ? '軌道を維持しています' : focus.remaining === focus.total ? '準備完了' : '一時停止中';
    $('#dashboardFocusTask').textContent = taskTitle;
    $('#miniTask').textContent = selectedTask?.title || 'ミッション未選択';
    [$('#focusRing'), $('#dashboardRing')].forEach((element) => element.style.setProperty('--progress', `${progress}%`));
    $('.focus-stage').classList.toggle('running', focus.running);
    const label = focus.running ? 'PAUSE' : 'START';
    $('#focusToggleButton span').textContent = label;
    $('#miniToggle').textContent = label;
    const iconPath = focus.running ? '<path d="M9 7v10M15 7v10"/>' : '<path d="m9 7 8 5-8 5z"/>';
    $('#focusToggleButton svg').innerHTML = iconPath;
    $('#dashboardFocusToggle svg').innerHTML = iconPath;
    const presets = [25, 50, 90];
    $$('#modeSelector button').forEach((button) => {
      const matches = button.dataset.minutes === 'custom' ? !presets.includes(focus.minutes) : Number(button.dataset.minutes) === focus.minutes;
      button.classList.toggle('active', matches);
      if (button.dataset.minutes === 'custom') button.textContent = `CUSTOM ${state?.settings?.customFocusMinutes || 40}`;
    });
  }

  function renderFocusSessions() {
    const todaySessions = state.focusSessions.filter((session) => todayKey(new Date(session.completedAt || session.startedAt)) === todayKey() && session.completed);
    const total = todaySessions.reduce((sum, session) => sum + Number(session.duration || 0), 0);
    $('#todayFocusMinutes').textContent = `${total}m`;
    $('#sessionTimeline').innerHTML = todaySessions.length
      ? [...todaySessions].reverse().slice(0, 5).map((session) => {
          const date = new Date(session.completedAt || session.startedAt);
          return `<div class="session-item"><strong>${escapeHtml(session.taskTitle || '自由集中')}</strong><span>${pad(date.getHours())}:${pad(date.getMinutes())} · ${Number(session.duration || 0)} MIN</span></div>`;
        }).join('')
      : '<div class="empty-state"><div><strong>まだ静かな一日です</strong><span>最初の集中セッションを始めましょう。</span></div></div>';
  }

  function weekData() {
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = todayKey(date);
      const sessions = state.focusSessions.filter((session) => session.completed && todayKey(new Date(session.completedAt || session.startedAt)) === key);
      days.push({ date, key, minutes: sessions.reduce((sum, session) => sum + Number(session.duration || 0), 0), sessions: sessions.length });
    }
    return days;
  }

  function calculateStreak() {
    const activeDays = new Set([
      ...state.focusSessions.filter((session) => session.completed).map((session) => todayKey(new Date(session.completedAt || session.startedAt))),
      ...state.tasks.filter((task) => task.done && task.completedAt).map((task) => todayKey(new Date(task.completedAt))),
      ...state.planItems.filter((item) => item.done).map((item) => item.date),
      ...state.habits.flatMap((habit) => habit.completions)
    ]);
    let streak = 0;
    const cursor = new Date();
    if (!activeDays.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(todayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }

  function renderStats() {
    const week = weekData();
    const sessions = week.reduce((sum, day) => sum + day.sessions, 0);
    const minutes = week.reduce((sum, day) => sum + day.minutes, 0);
    const streak = calculateStreak();
    $('#weeklySessions').textContent = sessions;
    $('#weeklyMinutes').textContent = minutes;
    $('#streakDays').textContent = streak;
    const goal = Number(state.settings.weeklyGoal || 12);
    $('#weeklyTrend').textContent = `${Math.min(999, Math.round((sessions / goal) * 100))}% GOAL`;

    const completed = state.tasks.filter((task) => task.done).length;
    const total = state.tasks.length;
    const completion = total ? Math.round((completed / total) * 100) : 0;
    const averageEnergy = state.energyEntries.length ? (state.energyEntries.slice(-7).reduce((sum, entry) => sum + Number(entry.value || 0), 0) / Math.min(7, state.energyEntries.length)).toFixed(1) : '—';
    const recentDates = new Set(week.map((day) => day.key));
    const ritualTotal = state.habits.length * 7;
    const ritualDone = state.habits.reduce((sum, habit) => sum + habit.completions.filter((date) => recentDates.has(date)).length, 0);
    const ritualRate = ritualTotal ? `${Math.round((ritualDone / ritualTotal) * 100)}%` : '—';
    $('#insightKpis').innerHTML = [
      ['FOCUS TIME', `${minutes}m`, `${sessions} sessions`],
      ['MISSION RATE', `${completion}%`, `${completed} completed`],
      ['CURRENT STREAK', `${streak}d`, streak ? '軌道を維持中' : '今日から始めよう'],
      ['RITUAL RATE', ritualRate, `${ritualDone} check-ins`],
      ['AVG. ENERGY', averageEnergy, 'out of 5.0']
    ].map(([label, value, detail]) => `<div class="kpi-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join('');
    renderDistribution();
    renderHeatmap();
    renderChartsSoon();
  }

  function renderDistribution() {
    const categories = ['WORK', 'PERSONAL', 'GROWTH', 'FOCUS'];
    const counts = categories.map((category) => state.tasks.filter((task) => task.category === category).length);
    const total = Math.max(1, counts.reduce((sum, count) => sum + count, 0));
    const p1 = (counts[0] / total) * 100;
    const p2 = p1 + (counts[1] / total) * 100;
    const p3 = p2 + (counts[2] / total) * 100;
    $('#distributionChart').innerHTML = `<div class="distribution-ring" style="--p1:${p1}%;--p2:${p2}%;--p3:${p3}%"><div><span><strong>${state.tasks.length}</strong>TOTAL</span></div></div>
      <div class="distribution-legend">${categories.map((category, index) => `<div><i style="background:${categoryColors[category]}"></i><span>${category} · ${counts[index]}</span></div>`).join('')}</div>`;
  }

  function renderHeatmap() {
    const counts = new Map();
    state.focusSessions.filter((session) => session.completed).forEach((session) => {
      const key = todayKey(new Date(session.completedAt || session.startedAt));
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    state.tasks.filter((task) => task.done && task.completedAt).forEach((task) => {
      const key = todayKey(new Date(task.completedAt));
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    state.planItems.filter((item) => item.done).forEach((item) => counts.set(item.date, (counts.get(item.date) || 0) + 1));
    state.habits.forEach((habit) => habit.completions.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1)));
    const cells = [];
    for (let offset = 34; offset >= 0; offset -= 1) {
      const date = new Date(); date.setDate(date.getDate() - offset);
      const count = counts.get(todayKey(date)) || 0;
      cells.push(`<div class="heat-cell" data-level="${Math.min(4, count)}" title="${todayKey(date)}: ${count} activity"></div>`);
    }
    $('#activityHeatmap').innerHTML = cells.join('');
  }

  function renderChartsSoon() {
    requestAnimationFrame(() => { drawWeeklyChart($('#miniChart'), true); drawWeeklyChart($('#insightsChart'), false); });
  }

  function cssColor(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

  function drawWeeklyChart(canvas, compact) {
    if (!canvas || canvas.offsetWidth === 0) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    const data = weekData();
    const values = data.map((day) => day.minutes);
    const max = Math.max(60, ...values);
    const left = compact ? 4 : 36;
    const right = 8;
    const top = 17;
    const bottom = compact ? 19 : 30;
    const chartHeight = height - top - bottom;
    const step = (width - left - right) / Math.max(1, data.length - 1);
    const accent = cssColor('--accent');
    const muted = cssColor('--muted');
    const grid = cssColor('--md-sys-color-outline-variant');
    const emptyPoint = cssColor('--md-sys-color-surface-container-highest');

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.globalAlpha = .38;
    const lines = compact ? 2 : 4;
    for (let i = 0; i <= lines; i += 1) {
      const y = top + (chartHeight / lines) * i;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      if (!compact && i < lines) {
        ctx.fillStyle = muted; ctx.globalAlpha = .58; ctx.font = '8px Cascadia Mono'; ctx.textAlign = 'right';
        ctx.fillText(String(Math.round(max - (max / lines) * i)), left - 7, y + 3);
      }
    }
    ctx.globalAlpha = 1;

    const points = data.map((day, index) => ({ x: left + index * step, y: top + chartHeight - (day.minutes / max) * chartHeight }));
    const gradient = ctx.createLinearGradient(0, top, 0, top + chartHeight);
    gradient.addColorStop(0, `${accent}55`); gradient.addColorStop(1, `${accent}00`);
    ctx.beginPath(); ctx.moveTo(points[0].x, top + chartHeight); points.forEach((point) => ctx.lineTo(point.x, point.y)); ctx.lineTo(points.at(-1).x, top + chartHeight); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = accent; ctx.lineWidth = compact ? 1.5 : 2; ctx.stroke();
    points.forEach((point, index) => {
      ctx.beginPath(); ctx.arc(point.x, point.y, compact ? 2 : 3, 0, Math.PI * 2); ctx.fillStyle = values[index] ? accent : emptyPoint; ctx.fill();
    });
    const labels = ['日', '月', '火', '水', '木', '金', '土'];
    ctx.fillStyle = muted; ctx.globalAlpha = .58; ctx.font = compact ? '7px Segoe UI' : '9px Segoe UI'; ctx.textAlign = 'center';
    data.forEach((day, index) => ctx.fillText(labels[day.date.getDay()], points[index].x, height - 3));
    ctx.globalAlpha = 1;
  }

  function checkAchievements() {
    const checks = [
      { id: 'first-focus', condition: state.focusSessions.filter((s) => s.completed).length >= 1, title: 'FIRST ORBIT', copy: '最初の集中セッションを完了しました。' },
      { id: 'five-focus', condition: state.focusSessions.filter((s) => s.completed).length >= 5, title: 'DEEP PILOT', copy: '5回の集中セッションを完了しました。' },
      { id: 'five-tasks', condition: state.tasks.filter((t) => t.done).length >= 5, title: 'MISSION MAKER', copy: '5つのミッションを完了しました。' },
      { id: 'ritual-week', condition: state.habits.some((habit) => habitStreak(habit) >= 7), title: 'RITUAL KEEPER', copy: 'ひとつの習慣を7日間続けました。' }
    ];
    checks.forEach((achievement) => {
      if (achievement.condition && !state.achievements.includes(achievement.id)) {
        state.achievements.push(achievement.id);
        setTimeout(() => showToast(`ACHIEVEMENT · ${achievement.title}`, achievement.copy), 450);
      }
    });
  }

  function openSettings() {
    renderSettings();
    $('#settingsModal').classList.add('open');
    $('#settingsModal').setAttribute('aria-hidden', 'false');
  }

  function closeSettings() {
    $('#settingsModal').classList.remove('open');
    $('#settingsModal').setAttribute('aria-hidden', 'true');
  }

  function renderSettings() {
    $('#settingName').value = state.profile.name || '';
    $('#settingGoal').value = state.settings.weeklyGoal || 12;
    $('#settingCustomFocus').value = state.settings.customFocusMinutes || 40;
    $('#settingAccentColor').value = state.settings.accentColor || themeSeeds.violet;
    $('#accentColorValue').value = (state.settings.accentColor || themeSeeds.violet).toUpperCase();
    $('#settingMotionIntensity').value = state.settings.motionIntensity || 'expressive';
    $('#settingLocale').value = state.settings.locale || 'system';
    $('#settingNotifications').checked = Boolean(state.settings.notifications);
    $('#settingReducedMotion').checked = Boolean(state.settings.reducedMotion);
    $('#settingCloseToTray').checked = Boolean(state.settings.closeToTray);
    $('#volumeSlider').value = Math.round(Number(state.settings.volume || 0) * 100);
    $('#volumeOutput').value = `${$('#volumeSlider').value}%`;
    $$('#soundOptions button').forEach((button) => button.classList.toggle('active', button.dataset.sound === state.settings.soundscape));
    $$('#appearanceOptions button').forEach((button) => {
      const active = button.dataset.appearance === state.settings.appearance;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderThemeOptions();
  }

  function renderThemeOptions() {
    $$('#themeOptions button').forEach((button) => {
      const active = button.dataset.themeOption === state.settings.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateSettingsFromForm() {
    const previousCustom = Number(state.settings.customFocusMinutes || 40);
    state.profile.name = ($('#settingName').value.trim() || 'Explorer').slice(0, 40);
    state.settings.weeklyGoal = Math.min(50, Math.max(1, Number($('#settingGoal').value) || 12));
    state.settings.customFocusMinutes = Math.min(180, Math.max(5, Number($('#settingCustomFocus').value) || 40));
    state.settings.motionIntensity = $('#settingMotionIntensity').value;
    const previousLocale = state.settings.locale || 'system';
    state.settings.locale = $('#settingLocale').value;
    state.settings.notifications = $('#settingNotifications').checked;
    state.settings.reducedMotion = $('#settingReducedMotion').checked;
    state.settings.closeToTray = $('#settingCloseToTray').checked;
    window.asteria.setCloseToTray(state.settings.closeToTray);
    if (!focus.running && ![25, 50, 90].includes(focus.minutes) && focus.minutes === previousCustom) {
      focus.minutes = state.settings.customFocusMinutes;
      if (focus.phase === 'focus') { focus.total = focus.minutes * 60; focus.remaining = focus.total; }
      persistFocusRuntime();
    }
    applyDisplayPreferences();
    if (previousLocale !== state.settings.locale) i18n?.setLocale(state.settings.locale);
    renderHeader();
    renderStats();
    scheduleSave();
  }

  const automationConditionLabels = {
    overdue_open: '期限切れの未完了',
    due_today_open: '今日が期限の未完了',
    no_due_open: '期限がない未完了',
    high_priority_open: 'HIGHの未完了',
    waiting_stale: '14日以上WAITING',
    completed_today: '今日完了した項目'
  };

  const automationActionLabels = {
    priority_high: '優先度をHIGHへ',
    move_next: 'NEXTへ移動',
    set_due_today: '期限を今日へ',
    assign_inbox: 'Inboxへ整理',
    append_log: 'ログへ追記',
    schedule_today: '空き時間へ配置'
  };

  const templateColorIcons = { violet: '◷', cyan: '↻', amber: '△', green: '◇' };

  function renderNexus() {
    if (!$('#nexusView')) return;
    const report = diagnosticReport || engine.diagnoseWorkspace(state);
    const rules = state.automations?.rules || [];
    const history = state.automations?.history || [];
    $('#nexusHealthScore').textContent = report.score;
    $('#nexusEnabledCount').textContent = rules.filter((rule) => rule.enabled).length;
    $('#nexusTemplateCount').textContent = (state.templates || []).length;
    $('#nexusRunCount').textContent = history.length;
    $$('#nexusTabs [data-nexus-tab]').forEach((button) => {
      const active = button.dataset.nexusTab === activeNexusTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $$('[data-nexus-panel]').forEach((panel) => {
      const active = panel.dataset.nexusPanel === activeNexusTab;
      panel.classList.toggle('active', active);
      panel.setAttribute('aria-hidden', String(!active));
    });
    renderAutomations();
    renderTemplates();
    renderDiagnostics(report);
  }

  function renderAutomations() {
    const rules = state.automations?.rules || [];
    $('#automationList').innerHTML = rules.map((rule) => `<article class="panel automation-card ${rule.enabled ? 'enabled' : ''}" data-rule-id="${escapeHtml(rule.id)}">
      <div class="automation-card-head"><span class="automation-mark">${rule.builtin ? '✦' : '⌁'}</span><div><p class="panel-label">${rule.builtin ? 'ASTERIA RULE' : 'CUSTOM RULE'}</p><h3>${escapeHtml(rule.name)}</h3></div><button type="button" class="rule-toggle ${rule.enabled ? 'active' : ''}" data-auto-toggle="${escapeHtml(rule.id)}" aria-pressed="${String(rule.enabled)}" aria-label="${escapeHtml(rule.name)}を${rule.enabled ? '無効' : '有効'}にする"><i></i></button></div>
      <p class="automation-description">${escapeHtml(rule.description || '指定した条件と処理をローカルで実行します。')}</p>
      <div class="rule-flow"><span>${escapeHtml(automationConditionLabels[rule.condition] || rule.condition)}</span><b>→</b><span>${escapeHtml(automationActionLabels[rule.action] || rule.action)}</span></div>
      <footer><span>${rule.lastRunAt ? `最終 ${escapeHtml(i18n?.formatDate(new Date(rule.lastRunAt), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || new Date(rule.lastRunAt).toLocaleString('ja-JP'))}` : '未実行'} · ${Number(rule.runCount || 0)} RUNS</span><div>${rule.builtin ? '' : `<button type="button" class="icon-text-button danger" data-auto-delete="${escapeHtml(rule.id)}">削除</button>`}<button type="button" class="text-button" data-auto-run="${escapeHtml(rule.id)}">今すぐ実行</button></div></footer>
    </article>`).join('') || '<div class="panel empty-state"><span>自動化ルールがありません。</span></div>';
    const history = state.automations?.history || [];
    $('#automationHistory').innerHTML = history.length ? history.slice(0, 10).map((entry) => `<div class="automation-history-row"><span class="run-signal ${entry.count ? 'changed' : ''}">${entry.count ? '✓' : '–'}</span><div><strong>${escapeHtml(entry.ruleName)}</strong><small>${escapeHtml(automationActionLabels[entry.action] || entry.action)} · ${Number(entry.count || 0)}件更新</small></div><time>${escapeHtml(i18n?.formatDate(new Date(entry.at), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || new Date(entry.at).toLocaleString('ja-JP'))}</time></div>`).join('') : '<div class="empty-state automation-empty"><div><strong>実行履歴はまだありません</strong><span>ルールは手動実行、または有効化後の起動時に動きます。</span></div></div>';
  }

  function handleAutomationAction(event) {
    const toggle = event.target.closest('[data-auto-toggle]');
    const run = event.target.closest('[data-auto-run]');
    const remove = event.target.closest('[data-auto-delete]');
    if (toggle) {
      const rule = state.automations.rules.find((item) => item.id === toggle.dataset.autoToggle);
      if (!rule) return;
      rule.enabled = !rule.enabled;
      renderNexus(); scheduleSave(80);
      showToast(rule.enabled ? 'AUTOMATION ENABLED' : 'AUTOMATION PAUSED', rule.name);
    } else if (run) runAutomations([run.dataset.autoRun]);
    else if (remove) deleteAutomation(remove.dataset.autoDelete);
  }

  function runAutomations(ruleIds = null) {
    const before = JSON.parse(JSON.stringify(state));
    const result = engine.runAutomationRules(state, { ruleIds: Array.isArray(ruleIds) ? ruleIds : null });
    if (!result.rulesRun) {
      showToast('NO ACTIVE RULES', '実行するルールを有効にするか、「今すぐ実行」を選んでください。');
      return;
    }
    state = result.state;
    diagnosticReport = engine.diagnoseWorkspace(state);
    renderAll(); scheduleSave(60);
    showToast('AUTOMATION COMPLETE', `${result.rulesRun}ルールを実行し、${result.changeCount}件を更新しました。`, result.changeCount ? {
      actionLabel: '元に戻す',
      onAction: () => { state = before; diagnosticReport = engine.diagnoseWorkspace(state); renderAll(); scheduleSave(40); },
      actionToastTitle: 'AUTOMATION REVERTED',
      actionToastMessage: '自動化前の状態へ戻しました。'
    } : {});
  }

  function openAutomationModal() {
    $('#automationForm').reset();
    $('#automationModal').classList.add('open');
    $('#automationModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#automationName').focus(), 40);
  }

  function closeAutomationModal() {
    $('#automationModal').classList.remove('open');
    $('#automationModal').setAttribute('aria-hidden', 'true');
  }

  function saveAutomationFromForm(event) {
    event.preventDefault();
    const condition = $('#automationCondition').value;
    const action = $('#automationAction').value;
    const rule = engine.normalizeRule({
      id: uid(), name: $('#automationName').value.trim(), condition, action, enabled: true, builtin: false,
      description: `${automationConditionLabels[condition]}のとき、${automationActionLabels[action]}。`
    }, state.automations.rules.length);
    state.automations.rules.push(rule);
    closeAutomationModal(); renderNexus(); scheduleSave(50);
    showToast('RULE CREATED', `${rule.name}を有効化しました。`);
  }

  function deleteAutomation(id) {
    const index = state.automations.rules.findIndex((rule) => rule.id === id && !rule.builtin);
    if (index < 0) return;
    const [removed] = state.automations.rules.splice(index, 1);
    renderNexus(); scheduleSave(50);
    showToast('RULE REMOVED', removed.name, {
      actionLabel: '元に戻す',
      onAction: () => { state.automations.rules.splice(index, 0, removed); renderNexus(); scheduleSave(40); },
      actionToastTitle: 'RULE RESTORED', actionToastMessage: `${removed.name}を復元しました。`
    });
  }

  function clearAutomationHistory() {
    state.automations.history = [];
    renderNexus(); scheduleSave(40);
    showToast('HISTORY CLEARED', 'ルールと本体データは変更していません。');
  }

  function renderTemplates() {
    const templates = state.templates || [];
    $('#templateGrid').innerHTML = templates.map((template) => `<article class="panel template-card" data-template-id="${escapeHtml(template.id)}">
      <header><span class="template-symbol ${escapeHtml(template.color)}">${escapeHtml(template.icon || templateColorIcons[template.color] || '✦')}</span><span class="template-kind">${template.builtin ? 'ASTERIA BLUEPRINT' : 'CUSTOM BLUEPRINT'}</span></header>
      <h3>${escapeHtml(template.name)}</h3><p>${escapeHtml(template.description)}</p>
      <div class="template-metrics"><span><b>${template.tasks.length}</b> MISSIONS</span><span><b>${template.plans.length}</b> BLOCKS</span></div>
      <footer>${template.builtin ? '<span>CURATED</span>' : `<button type="button" class="icon-text-button danger" data-template-delete="${escapeHtml(template.id)}">削除</button>`}<button type="button" class="primary-button" data-template-deploy="${escapeHtml(template.id)}">この軌道を展開</button></footer>
    </article>`).join('');
  }

  function handleTemplateAction(event) {
    const deploy = event.target.closest('[data-template-deploy]');
    const remove = event.target.closest('[data-template-delete]');
    if (deploy) deployTemplate(deploy.dataset.templateDeploy);
    else if (remove) deleteTemplate(remove.dataset.templateDelete);
  }

  function deployTemplate(id) {
    const template = state.templates.find((item) => item.id === id);
    if (!template) return;
    const before = JSON.parse(JSON.stringify(state));
    try {
      const result = engine.instantiateTemplate(state, template);
      state = result.state;
      diagnosticReport = engine.diagnoseWorkspace(state);
      renderAll(); scheduleSave(60);
      showToast('BLUEPRINT DEPLOYED', `${template.name}から${result.created.taskIds.length}件のミッションを作成しました。`, {
        actionLabel: '元に戻す',
        onAction: () => { state = before; diagnosticReport = engine.diagnoseWorkspace(state); renderAll(); scheduleSave(40); },
        actionToastTitle: 'DEPLOYMENT REVERTED', actionToastMessage: `${template.name}の展開を元に戻しました。`
      });
    } catch (error) { showToast('DEPLOYMENT FAILED', error.message); }
  }

  function openTemplateModal() {
    $('#templateForm').reset();
    $('#templateModal').classList.add('open');
    $('#templateModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#templateName').focus(), 40);
  }

  function closeTemplateModal() {
    $('#templateModal').classList.remove('open');
    $('#templateModal').setAttribute('aria-hidden', 'true');
  }

  function saveTemplateFromForm(event) {
    event.preventDefault();
    const lines = $('#templateTasks').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 40);
    if (!lines.length) { showToast('BLUEPRINT EMPTY', 'ミッションを1件以上入力してください。'); return; }
    const color = $('#templateColor').value;
    const template = engine.normalizeTemplate({
      id: uid(), name: $('#templateName').value.trim(), description: $('#templateDescription').value.trim(), color,
      icon: templateColorIcons[color], builtin: false,
      tasks: lines.map((title, index) => ({ title, priority: index === 0 ? 'high' : 'medium', category: 'WORK', dueOffset: Math.floor(index / 3), estimatedMinutes: 25 })), plans: []
    }, state.templates.length);
    state.templates.push(template);
    closeTemplateModal(); renderNexus(); scheduleSave(50);
    showToast('BLUEPRINT SAVED', `${template.name}をテンプレートへ追加しました。`);
  }

  function deleteTemplate(id) {
    const index = state.templates.findIndex((template) => template.id === id && !template.builtin);
    if (index < 0) return;
    const [removed] = state.templates.splice(index, 1);
    renderNexus(); scheduleSave(50);
    showToast('BLUEPRINT REMOVED', removed.name, {
      actionLabel: '元に戻す',
      onAction: () => { state.templates.splice(index, 0, removed); renderNexus(); scheduleSave(40); },
      actionToastTitle: 'BLUEPRINT RESTORED', actionToastMessage: `${removed.name}を復元しました。`
    });
  }

  function scanWorkspace(notify = false) {
    diagnosticReport = engine.diagnoseWorkspace(state);
    state.diagnostics.lastScanAt = diagnosticReport.scannedAt;
    state.diagnostics.lastScore = diagnosticReport.score;
    renderNexus(); scheduleSave(40);
    if (notify) showToast(diagnosticReport.issues.length ? 'SCAN COMPLETE' : 'WORKSPACE HEALTHY', diagnosticReport.issues.length ? `${diagnosticReport.issues.length}個の確認ポイントを検出しました。` : 'データの参照・重複・予定に問題はありません。');
  }

  function renderDiagnostics(report) {
    $('#healthScore').textContent = report.score;
    $('#healthRing').style.setProperty('--health-score', `${report.score * 3.6}deg`);
    $('#healthSummary').textContent = report.summary;
    $('#healthScanTime').textContent = state.diagnostics?.lastScanAt ? `最終スキャン ${i18n?.formatDate(new Date(state.diagnostics.lastScanAt), { dateStyle: 'short', timeStyle: 'short' }) || new Date(state.diagnostics.lastScanAt).toLocaleString('ja-JP')}` : 'リアルタイムのプレビュー。結果を保存するにはスキャンしてください。';
    $('#diagnosticList').innerHTML = report.issues.length ? report.issues.map((issue) => `<article class="panel diagnostic-card ${escapeHtml(issue.severity)}" data-issue-id="${escapeHtml(issue.id)}"><span class="diagnostic-signal">${issue.severity === 'error' ? '!' : issue.severity === 'attention' ? '△' : 'i'}</span><div><p class="panel-label">${escapeHtml(issue.severity.toUpperCase())} · ${issue.count}</p><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.detail)}</p></div>${issue.fix ? `<button type="button" class="secondary-button" data-diagnostic-fix="${escapeHtml(issue.id)}">安全に修復</button>` : '<span class="review-badge">REVIEW</span>'}</article>`).join('') : '<article class="panel healthy-state"><span>✓</span><div><p class="panel-label">ALL SYSTEMS NOMINAL</p><h3>ワークスペースは健全です</h3><p>重複、壊れた参照、予定の重なりは見つかりませんでした。</p></div></article>';
  }

  function handleDiagnosticAction(event) {
    const button = event.target.closest('[data-diagnostic-fix]');
    if (!button) return;
    const report = diagnosticReport || engine.diagnoseWorkspace(state);
    const issue = report.issues.find((item) => item.id === button.dataset.diagnosticFix);
    if (!issue) return;
    const before = JSON.parse(JSON.stringify(state));
    const result = engine.repairIssue(state, issue);
    state = result.state;
    scanWorkspace(false); renderAll(); scheduleSave(40);
    showToast('REPAIR COMPLETE', `${issue.title}: ${result.changes}件を修復しました。`, {
      actionLabel: '元に戻す',
      onAction: () => { state = before; diagnosticReport = engine.diagnoseWorkspace(state); renderAll(); scheduleSave(40); },
      actionToastTitle: 'REPAIR REVERTED', actionToastMessage: '修復前の状態へ戻しました。'
    });
  }

  const exchangeFormatNames = {
    backup: 'JSON', tasksCsv: 'CSV', todoistCsv: 'TODOIST CSV', calendarIcs: 'ICS', calendarCsv: 'CALENDAR CSV', notesMarkdown: 'MARKDOWN'
  };

  function handleIntegrationAction(event) {
    const button = event.target.closest('[data-exchange-mode]');
    if (!button) return;
    openExchangeModal(button.dataset.exchangeMode, button.dataset.format || 'auto', button.dataset.service || 'ASTERIA');
  }

  function openExchangeModal(mode = 'export', format = 'backup', service = 'ASTERIA') {
    closeSettings();
    $('#exchangeMode').value = mode;
    $('#exchangeService').value = service;
    $('#exchangeModalTitle').textContent = mode === 'import' ? 'データを読み込む' : 'データを書き出す';
    $('#exchangeSubmitButton').textContent = mode === 'import' ? 'ファイルを選択' : '書き出す';
    $('#exchangeFormatField').hidden = mode === 'import';
    if (format !== 'auto') $('#exchangeFormat').value = format;
    const icons = { ASTERIA: '✦', 'Google Calendar': 'G', 'Outlook Calendar': 'O', Todoist: 'T', Notion: 'N', Trello: 'Tr', 'Excel / CSV': 'X' };
    const descriptions = {
      ASTERIA: 'JSON・CSV・ICS・Markdownに対応',
      'Google Calendar': 'ICS / CSV カレンダーブリッジ',
      'Outlook Calendar': 'ICS カレンダーブリッジ',
      Todoist: '公式列構成のUTF-8 CSV',
      Notion: 'データベースCSV / Markdown',
      Trello: 'ボードJSON / CSV',
      'Excel / CSV': '汎用UTF-8 CSV'
    };
    $('#exchangeServiceIcon').textContent = icons[service] || '↔';
    $('#exchangeServiceName').textContent = service;
    $('#exchangeServiceCopy').textContent = descriptions[service] || '安全なローカルファイル交換';
    $('#exchangeNotice').innerHTML = mode === 'import'
      ? '<b>安全な追加読み込み</b><span>CSV・ICS・Markdownは現在のデータへ追加され、ASTERIAバックアップのみ全体を復元します。</span>'
      : '<b>ローカル処理</b><span>書き出したファイルを対象サービス側で読み込んでください。認証情報は保存しません。</span>';
    $('#exchangeModal').classList.add('open');
    $('#exchangeModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => (mode === 'import' ? $('#exchangeSubmitButton') : $('#exchangeFormat')).focus(), 40);
  }

  function closeExchangeModal() {
    $('#exchangeModal').classList.remove('open');
    $('#exchangeModal').setAttribute('aria-hidden', 'true');
  }

  function addTransferHistory(entry) {
    state.integrations = state.integrations || { history: [] };
    state.integrations.history = [entry, ...(state.integrations.history || [])].slice(0, 50);
  }

  async function runExchange(event) {
    event.preventDefault();
    const mode = $('#exchangeMode').value;
    const service = $('#exchangeService').value;
    const submit = $('#exchangeSubmitButton');
    submit.disabled = true;
    submit.textContent = mode === 'import' ? '解析中…' : '作成中…';
    try {
      if (mode === 'export') {
        const format = $('#exchangeFormat').value;
        const result = await window.asteria.exportExchange({ format, value: state, service });
        if (result.canceled) return;
        if (result.error) { showToast('EXPORT FAILED', result.error); return; }
        addTransferHistory({ id: uid(), direction: 'export', service, format: exchangeFormatNames[format] || format, count: result.count || 0, fileName: result.fileName || '', at: new Date().toISOString() });
        scheduleSave(40); renderIntegrations(); closeExchangeModal();
        showToast('EXPORT COMPLETE', `${service}向け ${exchangeFormatNames[format] || format} を保存しました。`);
      } else {
        const result = await window.asteria.importExchange({ value: state, service });
        if (result.canceled) return;
        if (result.error) { showToast('IMPORT FAILED', result.error); return; }
        clearInterval(focus.interval);
        state = result.state;
        restoredFocusExpired = false;
        applyDisplayPreferences(); restoreFocusRuntime(); renderAll();
        if (focus.taskId && state.tasks.some((task) => task.id === focus.taskId && !task.done)) $('#focusTaskSelect').value = focus.taskId;
        if (restoredFocusExpired) completeFocusPhase(true);
        else if (focus.running) focus.interval = setInterval(tickFocus, 250);
        updateFocusDisplay(); closeExchangeModal();
        const parts = [];
        if (result.counts.tasks) parts.push(`ミッション${result.counts.tasks}件`);
        if (result.counts.planItems) parts.push(`予定${result.counts.planItems}件`);
        if (result.counts.notes) parts.push('ノート');
        showToast('IMPORT COMPLETE', `${parts.join('・') || 'データ'}を読み込みました。`);
      }
    } finally {
      submit.disabled = false;
      submit.textContent = mode === 'import' ? 'ファイルを選択' : '書き出す';
    }
  }

  function renderIntegrations() {
    const history = state.integrations?.history || [];
    $('#transferCount').textContent = history.length;
    $('#transferHistory').innerHTML = history.length ? history.slice(0, 12).map((entry) => {
      const date = new Date(entry.at);
      const timestamp = Number.isNaN(date.getTime()) ? '' : (i18n?.formatDate(date, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || date.toLocaleString('ja-JP'));
      return `<div class="transfer-row"><span class="transfer-direction ${entry.direction}">${entry.direction === 'import' ? '⇩' : '⇧'}</span><div><strong>${escapeHtml(entry.service)}</strong><small>${escapeHtml(entry.fileName || entry.format)}</small></div><span class="transfer-format">${escapeHtml(String(entry.format).toUpperCase())}</span><time>${escapeHtml(timestamp)}</time></div>`;
    }).join('') : '<div class="empty-state transfer-empty"><div><strong>交換履歴はまだありません</strong><span>サービスカードから最初のデータブリッジを開始できます。</span></div></div>';
  }

  function clearTransferHistory() {
    state.integrations.history = [];
    renderIntegrations(); scheduleSave(40);
    showToast('HISTORY CLEARED', 'データ交換履歴を消去しました。ファイルや本体データは削除されません。');
  }

  async function exportData() {
    const result = await window.asteria.exportData(state);
    if (!result.canceled) showToast('BACKUP COMPLETE', 'ASTERIAデータを書き出しました。');
  }

  async function importData() {
    const result = await window.asteria.importData();
    if (result.canceled) return;
    if (result.error) { showToast('IMPORT FAILED', result.error); return; }
    clearInterval(focus.interval);
    state = result.state;
    restoredFocusExpired = false;
    applyDisplayPreferences();
    restoreFocusRuntime();
    renderAll();
    if (focus.taskId && state.tasks.some((task) => task.id === focus.taskId && !task.done)) $('#focusTaskSelect').value = focus.taskId;
    if (restoredFocusExpired) completeFocusPhase(true);
    else if (focus.running) focus.interval = setInterval(tickFocus, 250);
    updateFocusDisplay();
    closeSettings();
    showToast('DATA RESTORED', 'バックアップを読み込みました。');
  }

  async function enterMiniMode() {
    miniModeActive = true;
    $('#miniFocus').classList.add('active');
    $('#miniFocus').setAttribute('aria-hidden', 'false');
    await window.asteria.miniMode(true);
  }

  async function exitMiniMode() {
    miniModeActive = false;
    $('#miniFocus').classList.remove('active');
    $('#miniFocus').setAttribute('aria-hidden', 'true');
    await window.asteria.miniMode(false);
  }

  function buildCommandPalette() {
    const palette = $('#commandPalette');
    if (palette.dataset.bound) return;
    palette.dataset.bound = 'true';
    palette.addEventListener('mousedown', (event) => { if (event.target === palette) closeCommandPalette(); });
    $('#commandSearch').addEventListener('input', () => { commandIndex = 0; renderCommands(); });
    $('#commandResults').addEventListener('click', (event) => {
      const item = event.target.closest('[data-command]');
      if (item) executeCommand(item.dataset.command);
    });
  }

  function commands() {
    const base = [
      { id: 'new-task', icon: '+', label: '新しいミッション', detail: 'タスクを素早く追加', keys: 'Ctrl N', run: () => openTaskModal() },
      { id: 'new-project', icon: '◉', label: '新しいプロジェクト', detail: 'ミッションを目的別にまとめる', run: () => { navigate('missions'); openProjectModal(); } },
      { id: 'new-plan', icon: '◫', label: '予定を追加', detail: `${plannerDate} の時間ブロック`, keys: 'Ctrl ⇧ N', run: () => { navigate('planner'); openPlanModal(); } },
      { id: 'auto-plan', icon: '✦', label: '空き時間へ自動配置', detail: `${plannerDate} の優先ミッションを計画`, run: () => { navigate('planner'); autoPlanDay(); } },
      { id: 'new-habit', icon: '◇', label: '習慣を追加', detail: '続けたい行動をトラッキング', run: () => { navigate('planner'); openHabitModal(); } },
      { id: 'toggle-focus', icon: '◷', label: focus.running ? '集中を一時停止' : '集中を開始', detail: `${focus.minutes}分タイマー`, keys: 'Ctrl ↵', run: () => { navigate('focus'); toggleFocus(); } },
      { id: 'dashboard', icon: '⌂', label: 'ホームへ移動', detail: '今日の司令室', run: () => navigate('dashboard') },
      { id: 'missions', icon: '◎', label: 'ミッションを開く', detail: 'すべてのタスク', run: () => navigate('missions') },
      { id: 'mission-board', icon: '▦', label: 'ミッションボードを開く', detail: '状態ごとのカンバン表示', run: () => { navigate('missions'); if (missionMode !== 'board') toggleMissionMode(); } },
      { id: 'planner', icon: '◫', label: 'デイリープランを開く', detail: '予定と習慣の軌道', run: () => navigate('planner') },
      { id: 'weekly-cockpit', icon: '▥', label: '週次コックピットを開く', detail: '7日間の予定と期限', run: () => { plannerMode = 'week'; navigate('planner'); renderPlanner(); } },
      { id: 'logbook', icon: '▤', label: 'ログブックを開く', detail: '思考とメモ', run: () => navigate('logbook') },
      { id: 'nexus', icon: '✦', label: 'NEXUSを開く', detail: '自動化・テンプレート・データ診断', run: () => navigate('nexus') },
      { id: 'run-automations', icon: '⌁', label: '有効な自動化を実行', detail: '許可したローカルルールをまとめて適用', run: () => { activeNexusTab = 'automations'; navigate('nexus'); runAutomations(); } },
      { id: 'scan-health', icon: '◇', label: 'データ健全性をスキャン', detail: '重複・参照・予定の重なりを検査', run: () => { activeNexusTab = 'health'; navigate('nexus'); scanWorkspace(true); } },
      { id: 'integrations', icon: '↔', label: 'サービス連携を開く', detail: 'Calendar・Todoist・Notion・Trello・CSV', run: () => navigate('integrations') },
      { id: 'insights', icon: '⌁', label: 'インサイトを開く', detail: '集中と完了の記録', run: () => navigate('insights') },
      { id: 'mini', icon: '⊡', label: 'ミニフォーカス', detail: '最前面の小さなタイマー', run: enterMiniMode },
      { id: 'export', icon: '⇧', label: 'データを書き出す', detail: 'JSON・CSV・ICS・Markdown', run: () => openExchangeModal('export') },
      { id: 'import', icon: '⇩', label: 'データを読み込む', detail: '各サービスのファイルを自動判定', run: () => openExchangeModal('import', 'auto') },
      { id: 'settings', icon: '⚙', label: '設定を開く', detail: '外観・カラー・モーション・通知', run: openSettings }
    ];
    return base;
  }

  function openWorkspaceResult(result) {
    if (result.type === 'task') {
      projectFilter = 'all';
      taskFilter = result.entity.done ? 'done' : 'open';
      $('#taskSearch').value = result.title;
      $$('#taskFilters [data-filter]').forEach((button) => button.classList.toggle('active', button.dataset.filter === taskFilter));
      navigate('missions'); renderMissionTasks(); renderProjectStrip();
    } else if (result.type === 'project') {
      projectFilter = result.id; taskFilter = 'open'; $('#taskSearch').value = '';
      navigate('missions'); renderProjectStrip(); renderMissionTasks();
    } else if (result.type === 'plan') {
      plannerDate = result.entity.date; plannerMode = 'day'; navigate('planner'); renderPlanner();
    } else if (result.type === 'habit') {
      plannerDate = todayKey(); plannerMode = 'day'; navigate('planner'); renderPlanner();
      setTimeout(() => document.querySelector(`[data-habit-id="${CSS.escape(result.id)}"]`)?.scrollIntoView({ block: 'center', behavior: state.settings.reducedMotion ? 'auto' : 'smooth' }), 60);
    } else if (result.type === 'note') {
      navigate('logbook');
      const textarea = $('#fullNotes');
      const lines = textarea.value.split(/\r?\n/);
      const offset = lines.slice(0, Math.max(0, Number(result.line || 1) - 1)).reduce((sum, line) => sum + line.length + 1, 0);
      textarea.focus(); textarea.setSelectionRange(offset, offset + (lines[Number(result.line || 1) - 1]?.length || 0));
    } else if (result.type === 'automation') {
      activeNexusTab = 'automations'; navigate('nexus'); renderNexus();
    } else if (result.type === 'template') {
      activeNexusTab = 'templates'; navigate('nexus'); renderNexus();
    }
  }

  function workspaceSearchCommands(query) {
    const icons = { task: '◎', project: '◉', plan: '◫', habit: '◇', note: '▤', automation: '⌁', template: '▦' };
    const labels = { task: 'MISSION', project: 'PROJECT', plan: 'PLAN', habit: 'RITUAL', note: 'LOGBOOK', automation: 'AUTOMATION', template: 'BLUEPRINT' };
    return engine.searchWorkspace(state, query, { limit: 40 }).map((result) => ({
      id: `search:${result.type}:${result.id}`,
      icon: icons[result.type] || '•',
      label: result.title,
      detail: `${labels[result.type] || result.type.toUpperCase()} · ${result.subtitle}`,
      run: () => openWorkspaceResult(result)
    }));
  }

  function filteredCommands() {
    const rawQuery = ($('#commandSearch')?.value || '').trim();
    const query = rawQuery.toLowerCase();
    const actionMatches = commands().filter((command) => !query || `${command.label} ${command.detail}`.toLowerCase().includes(query));
    const matches = query ? [...actionMatches, ...workspaceSearchCommands(rawQuery)] : actionMatches;
    if (rawQuery.length >= 2 && !state.tasks.some((task) => task.title.toLowerCase() === query)) {
      matches.push({
        id: 'quick-create', icon: '+', label: `「${rawQuery}」をミッションに追加`, detail: '入力内容からクイック作成',
        run: () => {
          const quickProject = projectFilter !== 'all' && projectFilter !== 'none' ? projectFilter : null;
          state.tasks.unshift({ id: uid(), title: rawQuery.slice(0, 100), detail: '', priority: 'medium', category: 'WORK', due: todayKey(), status: 'next', projectId: quickProject, recurrence: 'none', seriesId: null, estimatedMinutes: 25, subtasks: [], done: false, createdAt: new Date().toISOString(), completedAt: null });
          renderTasks(); renderPlanner(); renderStats(); scheduleSave(100); showToast('MISSION CREATED', rawQuery.slice(0, 100));
        }
      });
    }
    return matches;
  }

  function renderCommands() {
    const list = filteredCommands();
    commandIndex = Math.min(commandIndex, Math.max(0, list.length - 1));
    $('#commandResults').innerHTML = `<div class="command-group-label">ACTIONS & WORKSPACE</div>${list.map((command, index) => `<button type="button" class="command-item ${index === commandIndex ? 'selected' : ''}" data-command="${escapeHtml(command.id)}"><i>${escapeHtml(command.icon)}</i><span>${escapeHtml(command.label)}<small>${escapeHtml(command.detail)}</small></span>${command.keys ? `<kbd>${escapeHtml(command.keys)}</kbd>` : ''}</button>`).join('') || '<div class="empty-state"><span>一致するコマンドがありません</span></div>'}`;
  }

  function openCommandPalette() {
    $('#commandPalette').classList.add('open');
    $('#commandPalette').setAttribute('aria-hidden', 'false');
    $('#commandSearch').value = '';
    commandIndex = 0;
    renderCommands();
    setTimeout(() => $('#commandSearch').focus(), 30);
  }

  function closeCommandPalette() { $('#commandPalette')?.classList.remove('open'); $('#commandPalette')?.setAttribute('aria-hidden', 'true'); }

  function executeCommand(id) {
    const command = filteredCommands().find((item) => item.id === id);
    closeCommandPalette();
    command?.run();
  }

  function handleKeyboard(event) {
    const paletteOpen = $('#commandPalette')?.classList.contains('open');
    if (event.ctrlKey && event.key.toLowerCase() === 'k') { event.preventDefault(); paletteOpen ? closeCommandPalette() : openCommandPalette(); return; }
    if (paletteOpen && event.key === 'ArrowDown') { event.preventDefault(); commandIndex = Math.min(filteredCommands().length - 1, commandIndex + 1); renderCommands(); return; }
    if (paletteOpen && event.key === 'ArrowUp') { event.preventDefault(); commandIndex = Math.max(0, commandIndex - 1); renderCommands(); return; }
    if (paletteOpen && event.key === 'Enter') { event.preventDefault(); const item = filteredCommands()[commandIndex]; if (item) executeCommand(item.id); return; }
    if (event.key === 'Escape') { closeCommandPalette(); closeTaskModal(); closeProjectModal(); closePlanModal(); closeHabitModal(); closeSettings(); closeExchangeModal(); closeAutomationModal(); closeTemplateModal(); if (miniModeActive) exitMiniMode(); return; }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); navigate('planner'); openPlanModal(); return; }
    if (event.ctrlKey && event.key.toLowerCase() === 'n') { event.preventDefault(); openTaskModal(); return; }
    if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); toggleFocus(); }
  }

  function showToast(title, message, options = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>${options.actionLabel ? `<button type="button">${escapeHtml(options.actionLabel)}</button>` : ''}</div>`;
    $('#toastRegion').appendChild(toast);
    const duration = options.actionLabel ? 6500 : 3800;
    const fadeTimer = setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(12px)'; toast.style.transition = '.25s ease'; }, duration);
    const removeTimer = setTimeout(() => toast.remove(), duration + 300);
    toast.querySelector('button')?.addEventListener('click', () => {
      clearTimeout(fadeTimer); clearTimeout(removeTimer);
      options.onAction?.(); toast.remove();
      showToast(options.actionToastTitle || 'RESTORED', options.actionToastMessage || '削除した項目を元に戻しました。');
    });
  }

  function initializeStarfield() {
    const canvas = $('#starfield');
    const ctx = canvas.getContext('2d');
    let stars = [];
    let mouseX = 0;
    let mouseY = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.floor((innerWidth * innerHeight) / 16000) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * .8 + .15, a: Math.random() * .45 + .1, drift: Math.random() * .06 + .015 }));
    };
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (event) => { mouseX = (event.clientX / innerWidth - .5) * 4; mouseY = (event.clientY / innerHeight - .5) * 4; });
    resize();
    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((star) => {
        star.y -= star.drift;
        if (star.y < -2) star.y = innerHeight + 2;
        ctx.beginPath(); ctx.arc(star.x + mouseX * star.r, star.y + mouseY * star.r, star.r, 0, Math.PI * 2);
        ctx.fillStyle = cssColor('--md-sys-color-primary');
        ctx.globalAlpha = star.a * (document.body.dataset.colorScheme === 'light' ? .34 : .8);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    };
    draw();
  }

  const audioEngine = {
    context: null,
    master: null,
    nodes: [],
    playing: false,
    type: 'cosmos',
    volume: .32,
    configure(type, volume) { this.type = type || 'cosmos'; this.volume = Number(volume ?? .32); this.setVolume(this.volume); },
    ensureContext() {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume();
    },
    createNoise(seconds = 3) {
      const length = this.context.sampleRate * seconds;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = last * .97 + white * .03;
        data[i] = this.type === 'rain' ? white * .38 : last * 2.1;
      }
      const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = true;
      return source;
    },
    start() {
      this.ensureContext();
      if (this.playing) return;
      this.playing = true;
      const noise = this.createNoise();
      const filter = this.context.createBiquadFilter();
      const noiseGain = this.context.createGain();
      if (this.type === 'rain') { filter.type = 'highpass'; filter.frequency.value = 900; noiseGain.gain.value = .45; }
      else if (this.type === 'cafe') { filter.type = 'bandpass'; filter.frequency.value = 620; filter.Q.value = .35; noiseGain.gain.value = .55; }
      else { filter.type = 'lowpass'; filter.frequency.value = 420; noiseGain.gain.value = .72; }
      noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(this.master); noise.start();
      this.nodes.push(noise, filter, noiseGain);

      if (this.type === 'cosmos') {
        [55, 82.5].forEach((frequency, index) => {
          const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
          oscillator.type = index ? 'sine' : 'triangle'; oscillator.frequency.value = frequency; gain.gain.value = index ? .035 : .025;
          oscillator.connect(gain); gain.connect(this.master); oscillator.start(); this.nodes.push(oscillator, gain);
        });
      }
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(this.volume * .3, this.context.currentTime + 1.2);
      updateSoundButton();
    },
    stop() {
      if (!this.context || !this.playing) return;
      this.playing = false;
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(0, this.context.currentTime + .35);
      const nodes = [...this.nodes]; this.nodes = [];
      setTimeout(() => nodes.forEach((node) => { try { node.stop?.(); node.disconnect?.(); } catch { /* already stopped */ } }), 420);
      updateSoundButton();
    },
    restart() { this.stop(); setTimeout(() => this.start(), 460); },
    setVolume(value) {
      this.volume = Number(value);
      if (this.master && this.playing) this.master.gain.setTargetAtTime(this.volume * .3, this.context.currentTime, .08);
    },
    softStartIfEnabled() { if (this.playing) this.setVolume(this.volume); }
  };

  function toggleSound() { audioEngine.playing ? audioEngine.stop() : audioEngine.start(); }
  function updateSoundButton() {
    const button = $('#soundToggle');
    button.classList.toggle('on', audioEngine.playing);
    button.innerHTML = `<span></span> ${audioEngine.playing ? 'ON' : 'OFF'}`;
  }

  initialize().catch((error) => {
    console.error(error);
    document.body.innerHTML = `<div style="padding:40px;color:white;font-family:Segoe UI"><h1>ASTERIAを起動できませんでした</h1><p>${escapeHtml(error.message)}</p></div>`;
  });
})();
