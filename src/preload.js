const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asteria', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (state) => ipcRenderer.invoke('data:save', state),
  saveSync: (state) => ipcRenderer.sendSync('data:save-sync', state),
  exportData: (state) => ipcRenderer.invoke('data:export', state),
  importData: () => ipcRenderer.invoke('data:import'),
  exportExchange: (request) => ipcRenderer.invoke('exchange:export', request),
  importExchange: (request) => ipcRenderer.invoke('exchange:import', request),
  windowControl: (action) => ipcRenderer.invoke('window:control', action),
  miniMode: (enabled) => ipcRenderer.invoke('window:mini', enabled),
  setCloseToTray: (enabled) => ipcRenderer.invoke('settings:close-to-tray', enabled),
  onNavigate: (callback) => ipcRenderer.on('app:navigate', (_event, view) => callback(view)),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body })
});
