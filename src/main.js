const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { JsonStore } = require('./store');
const { EXPORT_FORMATS, parseImport, mergeImport, serializeExport } = require('./data-exchange');

let mainWindow;
let store;
let tray;
let closeToTray = false;
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function createWindow() {
  const previewWidth = Number(process.env.ASTERIA_SCREENSHOT_WIDTH) || 1440;
  const previewHeight = Number(process.env.ASTERIA_SCREENSHOT_HEIGHT) || 900;
  mainWindow = new BrowserWindow({
    width: previewWidth,
    height: previewHeight,
    minWidth: 1040,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#080810',
    title: 'ASTERIA',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (closeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (process.env.ASTERIA_DIAGNOSTICS) {
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      console.log(`[renderer:${level}] ${message}`);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[renderer-gone]', details.reason, details.exitCode);
    });
  }

  const screenshotPath = process.env.ASTERIA_SCREENSHOT;
  if (screenshotPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const view = process.env.ASTERIA_SCREENSHOT_VIEW;
        const scheme = process.env.ASTERIA_SCREENSHOT_SCHEME;
        const accent = process.env.ASTERIA_SCREENSHOT_ACCENT;
        if (scheme && ['light', 'dark', 'system'].includes(scheme)) {
          await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-appearance="${scheme}"]')?.click()`);
        }
        if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
          await mainWindow.webContents.executeJavaScript(`(() => { const input = document.querySelector('#settingAccentColor'); if (input) { input.value = '${accent}'; input.dispatchEvent(new Event('input', { bubbles: true })); } })()`);
        }
        if (scheme || accent) await new Promise((resolve) => setTimeout(resolve, 450));
        if (view && ['dashboard', 'missions', 'planner', 'focus', 'logbook', 'nexus', 'integrations', 'insights'].includes(view)) {
          await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-nav="${view}"]')?.click()`);
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        if (view === 'settings') {
          await mainWindow.webContents.executeJavaScript("document.querySelector('#settingsButton')?.click()");
          await new Promise((resolve) => setTimeout(resolve, 520));
        }
        const mode = process.env.ASTERIA_SCREENSHOT_MODE;
        if (view === 'missions' && mode === 'board') {
          await mainWindow.webContents.executeJavaScript("document.querySelector('#missionViewButton')?.click()");
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (view === 'planner' && ['week', 'month'].includes(mode)) {
          await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-planner-mode="${mode}"]')?.click()`);
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (view === 'nexus' && ['automations', 'templates', 'health'].includes(mode)) {
          await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-nexus-tab="${mode}"]')?.click()`);
          if (mode === 'health') await mainWindow.webContents.executeJavaScript("document.querySelector('#healthScanButton')?.click()");
          await new Promise((resolve) => setTimeout(resolve, 480));
        }
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(screenshotPath, image.toPNG());
        app.quit();
      }, 2200);
    });
  }

  if (process.env.ASTERIA_SMOKE) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const script = fs.readFileSync(path.join(__dirname, '..', 'tools', 'ui-smoke.js'), 'utf8');
          const result = await mainWindow.webContents.executeJavaScript(script);
          console.log(`UI_SMOKE_RESULT=${JSON.stringify(result)}`);
          app.exit(result.ok ? 0 : 1);
        } catch (error) {
          console.error('UI_SMOKE_ERROR', error);
          app.exit(1);
        }
      }, 1300);
    });
  }
}

function showWindow(view = null) {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (view) {
    const sendNavigation = () => mainWindow?.webContents.send('app:navigate', view);
    if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', sendNavigation);
    else sendNavigation();
  }
}

function createTray() {
  if (tray) return;
  tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'));
  tray.setToolTip('ASTERIA — Personal Command Center');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'ASTERIAを開く', click: () => showWindow('dashboard') },
    { label: 'フォーカスを開く', click: () => showWindow('focus') },
    { label: '今日の予定を開く', click: () => showWindow('planner') },
    { type: 'separator' },
    { label: '終了', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => showWindow());
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

app.whenReady().then(() => {
  app.setAppUserModelId('studio.asteria.commandcenter');
  store = new JsonStore(app.getPath('userData'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !closeToTray) app.quit();
});

app.on('before-quit', () => { isQuitting = true; });

ipcMain.handle('data:load', () => store.load());
ipcMain.handle('data:save', (_event, value) => store.save(value));
ipcMain.on('data:save-sync', (event, value) => {
  try {
    store.save(value);
    event.returnValue = { ok: true };
  } catch (error) {
    event.returnValue = { ok: false, error: error.message };
  }
});

ipcMain.handle('data:export', async (_event, value) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'ASTERIA バックアップを保存',
    defaultPath: `ASTERIA-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'ASTERIA Backup', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(value, null, 2), 'utf8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('data:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'ASTERIA バックアップを読み込む',
    properties: ['openFile'],
    filters: [{ name: 'ASTERIA Backup', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const parsed = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    const state = JsonStore.validateImport(parsed);
    store.save(state);
    return { canceled: false, state };
  } catch (error) {
    return { canceled: false, error: error.message };
  }
});

ipcMain.handle('exchange:export', async (_event, { format, value, service = 'ASTERIA' } = {}) => {
  try {
    const descriptor = EXPORT_FORMATS[format];
    if (!descriptor) return { canceled: false, error: '未対応の書き出し形式です。' };
    const payload = serializeExport(format, value);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `${descriptor.label}を書き出す`,
      defaultPath: payload.defaultName,
      filters: [{ name: descriptor.label, extensions: [descriptor.extension] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, payload.content, 'utf8');
    return { canceled: false, filePath: result.filePath, fileName: path.basename(result.filePath), count: payload.count, service, format };
  } catch (error) {
    return { canceled: false, error: error.message };
  }
});

ipcMain.handle('exchange:import', async (_event, { value, service = 'ASTERIA' } = {}) => {
  const serviceFilters = {
    'Google Calendar': [{ name: 'Calendar', extensions: ['ics', 'csv'] }],
    'Outlook Calendar': [{ name: 'iCalendar', extensions: ['ics'] }],
    Todoist: [{ name: 'Todoist CSV', extensions: ['csv'] }],
    Notion: [{ name: 'Notion / Markdown', extensions: ['csv', 'md', 'markdown', 'txt'] }],
    Trello: [{ name: 'Trello export', extensions: ['json', 'csv'] }],
    'Excel / CSV': [{ name: 'CSV', extensions: ['csv'] }]
  };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `${service}からデータを読み込む`,
    properties: ['openFile'],
    filters: serviceFilters[service] || [{ name: 'Supported data', extensions: ['json', 'csv', 'ics', 'md', 'markdown', 'txt'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);
    if (stats.size > 20 * 1024 * 1024) throw new Error('安全のため20MBを超えるファイルは読み込めません。');
    const imported = parseImport(filePath, fs.readFileSync(filePath, 'utf8'));
    const merged = mergeImport(value, imported);
    const count = merged.counts.tasks + merged.counts.planItems + merged.counts.notes;
    merged.state.integrations.history.unshift({
      id: `transfer-${Date.now()}`,
      direction: 'import',
      service,
      format: path.extname(filePath).slice(1).toLowerCase(),
      count,
      fileName: path.basename(filePath),
      at: new Date().toISOString()
    });
    const saved = store.save(merged.state);
    return { canceled: false, state: saved, counts: merged.counts, count, source: imported.source, fileName: path.basename(filePath), service };
  } catch (error) {
    return { canceled: false, error: error.message };
  }
});

ipcMain.handle('window:control', (_event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (action === 'close') mainWindow.close();
});

ipcMain.handle('window:mini', (_event, enabled) => {
  if (!mainWindow) return false;
  mainWindow.setAlwaysOnTop(Boolean(enabled), 'floating');
  if (enabled) {
    mainWindow.setMinimumSize(380, 260);
    mainWindow.setSize(420, 300, true);
  } else {
    mainWindow.setMinimumSize(1040, 680);
    mainWindow.setSize(1240, 780, true);
    mainWindow.center();
  }
  return enabled;
});

ipcMain.handle('settings:close-to-tray', (_event, enabled) => {
  closeToTray = Boolean(enabled);
  if (closeToTray) createTray(); else destroyTray();
  return closeToTray;
});

ipcMain.handle('notify', (_event, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});
