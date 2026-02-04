const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getPlatform: () => ipcRenderer.invoke('platform'),

  // Window controls for frameless window
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Legacy tray controls
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  restoreFromTray: () => ipcRenderer.invoke('restore-from-tray'),

  // Menu events
  // Menu events
  onMenuNewApp: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('menu-new-app', subscription);
    return () => ipcRenderer.removeListener('menu-new-app', subscription);
  },
  onMenuAbout: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('menu-about', subscription);
    return () => ipcRenderer.removeListener('menu-about', subscription);
  },

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Development helpers
  openDevTools: () => ipcRenderer.send('open-dev-tools'),

  // System integration
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),

  // App lifecycle
  onAppReady: (callback) => ipcRenderer.on('app-ready', callback),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Service Management
  startService: (data) => ipcRenderer.invoke('service-start', data),
  stopService: (id) => ipcRenderer.invoke('service-stop', { id }),
  getServiceStatus: (id) => ipcRenderer.invoke('service-status', { id }),
  onServiceExit: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('service-exit', subscription);
    return () => ipcRenderer.removeListener('service-exit', subscription);
  },

  // BrowserView Management
  createBrowserView: (data) => ipcRenderer.invoke('browser-view-create', data),
  updateBrowserViewBounds: (bounds) => ipcRenderer.invoke('browser-view-update-bounds', bounds),
  reloadBrowserView: () => ipcRenderer.invoke('browser-view-reload'),
  hideBrowserView: () => ipcRenderer.invoke('browser-view-hide'),
  destroyBrowserView: (url) => ipcRenderer.invoke('browser-view-destroy', url),
  destroyAllBrowserViews: () => ipcRenderer.invoke('browser-view-destroy-all'),
  onBrowserViewLoadSuccess: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('browser-view-load-success', subscription);
    return () => ipcRenderer.removeListener('browser-view-load-success', subscription);
  },
  onBrowserViewLoadFail: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('browser-view-load-fail', subscription);
    return () => ipcRenderer.removeListener('browser-view-load-fail', subscription);
  },

  // Global shortcut handlers (from main process)
  onShortcutGoDashboard: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('shortcut-go-dashboard', subscription);
    return () => ipcRenderer.removeListener('shortcut-go-dashboard', subscription);
  },
  onShortcutNavigateApp: (callback) => {
    const subscription = (event, index) => callback(index);
    ipcRenderer.on('shortcut-navigate-app', subscription);
    return () => ipcRenderer.removeListener('shortcut-navigate-app', subscription);
  },
  onShortcutCycleApp: (callback) => {
    const subscription = (event, direction) => callback(direction);
    ipcRenderer.on('shortcut-cycle-app', subscription);
    return () => ipcRenderer.removeListener('shortcut-cycle-app', subscription);
  },

  // Antigravity integration
  openAntigravity: (directory) => ipcRenderer.invoke('open-antigravity', { directory })
});

// Expose Node.js environment info
contextBridge.exposeInMainWorld('nodeEnv', {
  platform: process.platform,
  version: process.version,
  electronVersion: process.versions.electron
});
