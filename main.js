const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

// 创建窗口
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // 加载页面
  if (process.argv.includes('--dev')) {
    // 开发模式加载本地React服务器
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // 生产模式加载简化的HTML页面
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'index-simple.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // 窗口关闭事件
  win.on('closed', () => {
    app.quit();
  });
}

// 应用准备就绪
app.on('ready', () => {
  createWindow();
});

// 所有窗口关闭事件
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS点击图标事件
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC通信示例
ipcMain.on('message', (event, arg) => {
  console.log(arg);
  event.reply('message-reply', '收到消息: ' + arg);
});

// 导出app对象，用于其他模块访问
module.exports = app;