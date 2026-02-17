const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let SERVER_PORT = 3000;

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

let mainWindow;
let serverProcess;
let serverReady = false;

async function startBackendServer() {
  if (isDev) {
    return;
  }

  try {
    SERVER_PORT = await findFreePort(3000);
    console.log('[Electron] Selected port:', SERVER_PORT);
  } catch (err) {
    console.error('[Electron] Failed to find free port:', err);
    throw err;
  }

  return new Promise((resolve, reject) => {
    const appPath = app.getAppPath();
    const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
    const serverPath = path.join(unpackedPath, 'server.js');
    const envPath = path.join(unpackedPath, '.env');
    
    console.log('[Electron] App path:', appPath);
    console.log('[Electron] Unpacked path:', unpackedPath);
    console.log('[Electron] Server path:', serverPath);
    console.log('[Electron] Server exists:', fs.existsSync(serverPath));
    
    const env = { ...process.env };
    env.NODE_ENV = 'production';
    env.PORT = SERVER_PORT;
    env.ELECTRON_RUN_AS_NODE = '1';
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalIndex = trimmedLine.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmedLine.substring(0, equalIndex).trim();
            const value = trimmedLine.substring(equalIndex + 1).trim();
            env[key] = value;
          }
        }
      });
    }

    console.log('[Electron] 启动后端服务器...');
    
    serverProcess = spawn(process.execPath, [serverPath], {
      env,
      cwd: unpackedPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Server]', output.trim());
      if (output.includes('服务器运行在') || output.includes('listening') || output.includes('缓存初始化完成') || output.includes('Server is running')) {
        if (!serverReady) {
          serverReady = true;
          console.log('[Electron] 后端服务器已就绪');
          setTimeout(resolve, 2000);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] 后端服务器启动失败:', err);
      reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log('[Electron] 后端服务器退出, code:', code, 'signal:', signal);
      serverProcess = null;
    });

    setTimeout(() => {
      if (!serverReady) {
        console.log('[Electron] 后端服务器启动超时，继续启动窗口...');
        serverReady = true;
        resolve();
      }
    }, 15000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '拾思',
    icon: isDev 
      ? path.join(__dirname, 'assets/icon.png')
      : path.join(app.getAppPath(), 'electron/assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#ffffff',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('[Electron] 加载前端页面: http://localhost:' + SERVER_PORT);
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: '拾思',
      submenu: [
        { role: 'about', label: '关于拾思' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏拾思' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出拾思' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '前置全部窗口' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '使用帮助',
          click: async () => {
            await shell.openExternal('https://github.com/your-repo/shisi');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  try {
    await startBackendServer();
    createWindow();
  } catch (err) {
    console.error('[Electron] 启动失败:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  mainWindow = null;
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});
