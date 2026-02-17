const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  openExternal: (url) => {
    require('electron').shell.openExternal(url);
  },
  
  platform: process.platform,
  isElectron: true,
});
