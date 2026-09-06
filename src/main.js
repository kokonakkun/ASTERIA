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
let appLocale = 'ja';

const nativeLocaleColumns = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de', 'pt-BR', 'hi', 'ar'];
const nativeLocaleRows = [
  ['ASTERIAを開く', 'Open ASTERIA', '打开 ASTERIA', '開啟 ASTERIA', 'ASTERIA 열기', 'Abrir ASTERIA', 'Ouvrir ASTERIA', 'ASTERIA öffnen', 'Abrir ASTERIA', 'ASTERIA खोलें', 'فتح ASTERIA'],
  ['フォーカスを開く', 'Open Focus', '打开专注', '開啟專注', '집중 열기', 'Abrir concentración', 'Ouvrir Concentration', 'Fokus öffnen', 'Abrir foco', 'फ़ोकस खोलें', 'فتح التركيز'],
  ['今日の予定を開く', "Open today's plan", '打开今日计划', '開啟今日計畫', '오늘 계획 열기', 'Abrir el plan de hoy', 'Ouvrir le plan du jour', 'Heutigen Plan öffnen', 'Abrir plano de hoje', 'आज की योजना खोलें', 'فتح خطة اليوم'],
  ['終了', 'Quit', '退出', '結束', '종료', 'Salir', 'Quitter', 'Beenden', 'Sair', 'बंद करें', 'إنهاء'],
  ['ASTERIA バックアップを保存', 'Save ASTERIA backup', '保存 ASTERIA 备份', '儲存 ASTERIA 備份', 'ASTERIA 백업 저장', 'Guardar copia de ASTERIA', 'Enregistrer la sauvegarde ASTERIA', 'ASTERIA-Sicherung speichern', 'Salvar backup do ASTERIA', 'ASTERIA बैकअप सहेजें', 'حفظ نسخة ASTERIA الاحتياطية'],
  ['ASTERIA バックアップを読み込む', 'Import ASTERIA backup', '导入 ASTERIA 备份', '匯入 ASTERIA 備份', 'ASTERIA 백업 가져오기', 'Importar copia de ASTERIA', 'Importer la sauvegarde ASTERIA', 'ASTERIA-Sicherung importieren', 'Importar backup do ASTERIA', 'ASTERIA बैकअप आयात करें', 'استيراد نسخة ASTERIA الاحتياطية'],
  ['未対応の書き出し形式です。', 'This export format is not supported.', '不支持此导出格式。', '不支援此匯出格式。', '지원하지 않는 내보내기 형식입니다.', 'Este formato de exportación no es compatible.', "Ce format d’exportation n’est pas pris en charge.", 'Dieses Exportformat wird nicht unterstützt.', 'Este formato de exportação não é compatível.', 'यह निर्यात प्रारूप समर्थित नहीं है।', 'تنسيق التصدير هذا غير مدعوم.'],
  ['安全のため20MBを超えるファイルは読み込めません。', 'Files larger than 20 MB cannot be imported for safety.', '为安全起见，无法导入超过 20 MB 的文件。', '基於安全考量，無法匯入超過 20 MB 的檔案。', '안전을 위해 20MB보다 큰 파일은 가져올 수 없습니다.', 'Por seguridad, no se pueden importar archivos de más de 20 MB.', 'Par sécurité, les fichiers de plus de 20 Mo ne peuvent pas être importés.', 'Dateien über 20 MB können aus Sicherheitsgründen nicht importiert werden.', 'Por segurança, arquivos acima de 20 MB não podem ser importados.', 'सुरक्षा के लिए 20 MB से बड़ी फ़ाइल आयात नहीं की जा सकती।', 'لأسباب أمنية، لا يمكن استيراد ملفات أكبر من 20 ميغابايت.']
];
const nativeDictionaries = Object.fromEntries(nativeLocaleColumns.map((locale) => [locale, new Map()]));
nativeLocaleRows.forEach((row) => nativeLocaleColumns.forEach((locale, index) => nativeDictionaries[locale].set(row[0], row[index] || row[1])));

function normalizeAppLocale(value) {
  const source = String(value || '').toLowerCase();
  if (source.startsWith('zh-tw') || source.startsWith('zh-hk') || source.startsWith('zh-hant')) return 'zh-TW';
  if (source.startsWith('zh')) return 'zh-CN';
  if (source.startsWith('pt')) return 'pt-BR';
  return nativeLocaleColumns.find((locale) => locale.toLowerCase() === source || locale.toLowerCase() === source.split('-')[0]) || 'en';
}

function nativeT(source) {
  if (appLocale === 'ja') return source;
  return nativeDictionaries[appLocale]?.get(source) || nativeDictionaries.en.get(source) || source;
}

function setAppLocale(value) {
  const nextLocale = value === 'system' ? normalizeAppLocale(app.getLocale()) : normalizeAppLocale(value);
  if (nextLocale === appLocale) return appLocale;
  appLocale = nextLocale;
  if (tray) { destroyTray(); createTray(); }
  return appLocale;
}

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
        const locale = process.env.ASTERIA_SCREENSHOT_LOCALE;
        if (locale && ['system', ...nativeLocaleColumns].includes(locale)) {
          await mainWindow.webContents.executeJavaScript(`(() => { const select = document.querySelector('#settingLocale'); if (select) { select.value = '${locale}'; select.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
        }
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
    { label: nativeT('ASTERIAを開く'), click: () => showWindow('dashboard') },
    { label: nativeT('フォーカスを開く'), click: () => showWindow('focus') },
    { label: nativeT('今日の予定を開く'), click: () => showWindow('planner') },
    { type: 'separator' },
    { label: nativeT('終了'), click: () => { isQuitting = true; app.quit(); } }
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

ipcMain.handle('data:load', () => {
  const value = store.load();
  setAppLocale(value.settings?.locale || 'system');
  return value;
});
ipcMain.handle('data:save', (_event, value) => {
  setAppLocale(value?.settings?.locale || 'system');
  return store.save(value);
});
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
    title: nativeT('ASTERIA バックアップを保存'),
    defaultPath: `ASTERIA-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'ASTERIA Backup', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(value, null, 2), 'utf8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('data:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: nativeT('ASTERIA バックアップを読み込む'),
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
    if (!descriptor) return { canceled: false, error: nativeT('未対応の書き出し形式です。') };
    const payload = serializeExport(format, value);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: appLocale === 'ja' ? `${descriptor.label}を書き出す` : `Export ${descriptor.label}`,
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
    title: appLocale === 'ja' ? `${service}からデータを読み込む` : `Import data from ${service}`,
    properties: ['openFile'],
    filters: serviceFilters[service] || [{ name: 'Supported data', extensions: ['json', 'csv', 'ics', 'md', 'markdown', 'txt'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);
    if (stats.size > 20 * 1024 * 1024) throw new Error(nativeT('安全のため20MBを超えるファイルは読み込めません。'));
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
