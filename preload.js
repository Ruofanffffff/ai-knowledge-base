const { contextBridge, ipcRenderer } = require('electron');

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送消息到主进程
  sendMessage: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  
  // 接收主进程的消息
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  
  // 移除消息监听
  removeMessageListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
  
  // 文件操作API
  file: {
    openDialog: () => ipcRenderer.invoke('file:open-dialog'),
    saveDialog: (options) => ipcRenderer.invoke('file:save-dialog', options),
    readFile: (path) => ipcRenderer.invoke('file:read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('file:write-file', path, content)
  }
});

// 暴露Node.js的path模块给渲染进程
contextBridge.exposeInMainWorld('path', {
  join: (...args) => require('path').join(...args),
  basename: (path, ext) => require('path').basename(path, ext),
  dirname: (path) => require('path').dirname(path),
  extname: (path) => require('path').extname(path)
});