const { app, BrowserWindow, Menu, shell, ipcMain, globalShortcut, BrowserView } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let activeBrowserView = null;
const serverUrl = 'http://localhost:5173';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false, // Don't show until ready-to-show
    frame: false, // Frameless for seamless modern look
    transparent: false, // Keep solid background for performance
    backgroundColor: '#0a0a0a' // Match app background
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(serverUrl);
    console.log('Loading development server at:', serverUrl);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading production build from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Set max listeners to prevent warning when switching many BrowserViews
  mainWindow.setMaxListeners(50);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hide the menu bar for frameless look (menu accessible via Alt key if needed)
  Menu.setApplicationMenu(null);
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New App',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-app');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: isDev ? 'Alt+F4' : process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About JellyOS Launcher',
          click: () => {
            mainWindow.webContents.send('menu-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  createWindow();

  // Register global shortcuts that work even when BrowserView has focus





  // Ctrl+1-9: Navigate to app by index
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      if (mainWindow) {
        mainWindow.webContents.send('shortcut-navigate-app', i - 1);
        mainWindow.webContents.focus();
      }
    });
  }

  // Ctrl+Tab: Cycle to next app
  globalShortcut.register('CommandOrControl+Tab', () => {
    if (mainWindow) {
      mainWindow.webContents.send('shortcut-cycle-app', 'next');
      mainWindow.webContents.focus();
    }
  });

  // Show/hide launcher
  globalShortcut.register('CmdOrCtrl+Space', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill all running services before quitting
  if (typeof killAllServices === 'function' && runningProcesses.size > 0) {
    killAllServices();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Handle IPC messages
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('platform', () => {
  return process.platform;
});

// Window control handlers for frameless window
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
    return true;
  }
  return false;
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Handle app minimize to tray (optional enhancement)
ipcMain.handle('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
    return true;
  }
  return false;
});

// Handle restore from tray
ipcMain.handle('restore-from-tray', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return true;
  }
  return false;
});

// -----------------------------------------------------------------------------
// BrowserView Management - Pooled views for state preservation
// -----------------------------------------------------------------------------

// Pool of BrowserViews keyed by app URL - preserves state across switches
const browserViewPool = new Map();
let currentViewUrl = null;

ipcMain.handle('browser-view-create', async (event, { url, bounds, appId }) => {
  if (!mainWindow) return;

  const cleanUrl = url.trim();

  // If already showing this exact URL, just update bounds if requested
  if (currentViewUrl === cleanUrl) {
    if (bounds && browserViewPool.has(cleanUrl)) {
      const view = browserViewPool.get(cleanUrl);
      view.setBounds(bounds);
    }
    return { success: true, cached: true, alreadyActive: true };
  }

  // Hide current view if there is a different one active
  if (currentViewUrl && browserViewPool.has(currentViewUrl)) {
    const currentView = browserViewPool.get(currentViewUrl);
    mainWindow.removeBrowserView(currentView);
  }

  // Check if we already have a view for this URL
  if (browserViewPool.has(cleanUrl)) {
    const existingView = browserViewPool.get(cleanUrl);

    // Re-attach the existing view
    mainWindow.addBrowserView(existingView);

    if (bounds) {
      existingView.setBounds(bounds);
    }

    currentViewUrl = cleanUrl;
    return { success: true, cached: true };
  }

  // Create a new view for this URL
  try {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    // Set theme-matching background to prevent flashes
    view.setBackgroundColor('#0a0a0a');

    mainWindow.addBrowserView(view);

    if (bounds) {
      view.setBounds(bounds);
    }

    view.setAutoResize({ width: true, height: true });

    // Load URL with improved error handling
    const loadOptions = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    let totalAttempts = 0;
    const maxAttempts = 15; // Increased for slow-starting services

    const tryLoad = async (targetUrl, attempt = 1) => {
      if (!view.webContents || view.webContents.isDestroyed()) return;
      totalAttempts++;

      console.log(`[BrowserView] Loading ${targetUrl} (Attempt ${totalAttempts}/${maxAttempts})`);

      try {
        await view.webContents.loadURL(targetUrl, loadOptions);
        console.log(`[BrowserView] Successfully loaded: ${targetUrl}`);
      } catch (err) {
        console.error(`[BrowserView] Load error: ${err.message} for ${targetUrl}`);

        if (totalAttempts < maxAttempts) {
          const delay = Math.min(attempt * 1000, 5000); // Backoff up to 5s

          // If localhost fails, try 127.0.0.1 as a fallback after 3 attempts
          let nextUrl = targetUrl;
          if (totalAttempts === 3 && targetUrl.includes('localhost')) {
            nextUrl = targetUrl.replace('localhost', '127.0.0.1');
            console.log(`[BrowserView] Localhost failed 3 times, switching to fallback: ${nextUrl}`);
          }

          setTimeout(() => tryLoad(nextUrl, attempt + 1), delay);
        }
      }
    };

    // Diagnostics
    view.webContents.on('did-start-loading', () => console.log(`[BrowserView] Started loading...`));
    view.webContents.on('did-finish-load', () => {
      console.log(`[BrowserView] Finished loading successfully.`);
      if (mainWindow) {
        mainWindow.webContents.send('browser-view-load-success', { url: cleanUrl });
      }
    });

    view.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
      console.error(`[BrowserView] Failed load: ${errorDescription} (${errorCode}) at ${validatedURL}`);
      if (mainWindow) {
        mainWindow.webContents.send('browser-view-load-fail', { url: cleanUrl, error: errorDescription });
      }
    });

    tryLoad(cleanUrl);

    // Store in pool
    browserViewPool.set(cleanUrl, view);
    currentViewUrl = cleanUrl;

    return { success: true, cached: false };
  } catch (error) {
    console.error('Failed to create BrowserView:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('browser-view-reload', () => {
  if (currentViewUrl && browserViewPool.has(currentViewUrl)) {
    const view = browserViewPool.get(currentViewUrl);
    view.webContents.reload();
    return true;
  }
  return false;
});

ipcMain.handle('browser-view-update-bounds', (event, bounds) => {
  if (currentViewUrl && browserViewPool.has(currentViewUrl)) {
    const view = browserViewPool.get(currentViewUrl);
    view.setBounds(bounds);
    return true;
  }
  return false;
});

// Hide view without destroying (preserves state for quick return)
ipcMain.handle('browser-view-hide', () => {
  if (mainWindow && currentViewUrl && browserViewPool.has(currentViewUrl)) {
    const view = browserViewPool.get(currentViewUrl);
    mainWindow.removeBrowserView(view);
    // Don't destroy - keep it in the pool!
    currentViewUrl = null;
    return true;
  }
  return false;
});

// Destroy a specific view (for when app is stopped or removed)
ipcMain.handle('browser-view-destroy', (event, url) => {
  const targetUrl = url || currentViewUrl;

  if (targetUrl && browserViewPool.has(targetUrl)) {
    const view = browserViewPool.get(targetUrl);

    if (mainWindow && currentViewUrl === targetUrl) {
      mainWindow.removeBrowserView(view);
    }

    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }

    browserViewPool.delete(targetUrl);

    if (currentViewUrl === targetUrl) {
      currentViewUrl = null;
    }

    return true;
  }
  return false;
});

// Destroy all views (for cleanup)
ipcMain.handle('browser-view-destroy-all', () => {
  for (const [url, view] of browserViewPool) {
    if (mainWindow) {
      try { mainWindow.removeBrowserView(view); } catch (e) { }
    }
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  }
  browserViewPool.clear();
  currentViewUrl = null;
  return true;
});

// -----------------------------------------------------------------------------
// Service / Process Management Logic (Ported from server.js)
// -----------------------------------------------------------------------------

const runningProcesses = new Map();

ipcMain.handle('service-start', async (event, { id, command, directory, port }) => {
  if (!command) {
    throw new Error('Command is required');
  }

  // Helper to kill process on a specific port (Windows only for now)
  const killByPort = async (p) => {
    if (!p || process.platform !== 'win32') return;
    try {
      const { execSync } = require('child_process');
      // Find PID on port
      const stdout = execSync(`netstat -ano | findstr :${p}`).toString();
      const lines = stdout.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${p}`)) {
          const pid = parts[4];
          if (pid && pid !== '0' && pid !== process.pid.toString()) {
            console.log(`   ⚠️  Port ${p} in use by PID ${pid}. Forcefully clearing...`);
            try { execSync(`taskkill /pid ${pid} /f /t`); } catch (e) { }
          }
        }
      }
    } catch (e) {
      // Port likely not in use, ignore error
    }
  };

  // 1. Kill existing process tracked by this instance
  if (runningProcesses.has(id)) {
    const existing = runningProcesses.get(id);
    console.log(`   ♻️  Stopping existing instance of [${id}]...`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', existing.process.pid.toString(), '/f', '/t'], { shell: true });
      } else {
        existing.process.kill('SIGKILL');
      }
    } catch (e) {
      console.error(`Error killing existing process ${id}:`, e);
    }
    runningProcesses.delete(id);
    // Short delay to let OS release the port
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 2. Proactively clear the port if provided (Zombies from previous app runs)
  if (port) {
    await killByPort(port);
  }

  const cwd = directory || process.cwd();
  const isWindows = process.platform === 'win32';
  let cmd, args;

  if (isWindows) {
    cmd = 'powershell';
    args = ['-NoLogo', '-ExecutionPolicy', 'Bypass', '-Command', `& { $ErrorActionPreference = 'Continue'; if (Test-Path $PROFILE) { . $PROFILE }; ${command}; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`];
  } else {
    const parts = command.split(' ');
    cmd = parts[0];
    args = parts.slice(1);
  }

  console.log(`\n🚀 Starting service [${id}] on port ${port || 'N/A'}: ${command}`);
  console.log(`   📁 Directory: ${cwd}`);

  try {
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    const logs = [];

    const appendLog = (type, text) => {
      logs.push({ type, text, time: Date.now() });
      if (logs.length > 100) logs.shift();
    };

    child.stdout.on('data', (data) => {
      const line = data.toString();
      appendLog('stdout', line);
      process.stdout.write(`[${id}] ${line}`);
    });

    child.stderr.on('data', (data) => {
      const line = data.toString();
      appendLog('stderr', line);
      process.stderr.write(`[${id}] ${line}`);
    });

    child.on('error', (err) => {
      console.error(`[${id}] Process error:`, err.message);
      runningProcesses.delete(id);
    });

    child.on('exit', (code) => {
      console.log(`[${id}] Process exited with code ${code}`);
      runningProcesses.delete(id);
      if (mainWindow) {
        mainWindow.webContents.send('service-exit', { id, code });
      }
    });

    runningProcesses.set(id, { process: child, logs, command, directory: cwd, port });

    return { success: true, message: `Started: ${command}` };
  } catch (err) {
    console.error(`Failed to start [${id}]:`, err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('service-stop', async (event, { id }) => {
  if (runningProcesses.has(id)) {
    const { process: proc } = runningProcesses.get(id);
    console.log(`\n⏹️  Stopping service [${id}]\n`);

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { shell: true });
    } else {
      proc.kill('SIGTERM');
    }

    // Also clear port just in case (e.g. if process spawned children that survived)
    const { port } = runningProcesses.get(id);
    if (port && process.platform === 'win32') {
      setTimeout(() => {
        try {
          const { execSync } = require('child_process');
          const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
          if (stdout.includes(`:${port}`)) {
            const pid = stdout.trim().split(/\s+/).pop();
            if (pid && pid !== '0' && pid !== process.pid.toString()) {
              execSync(`taskkill /pid ${pid} /f /t`);
            }
          }
        } catch (e) { }
      }, 1000);
    }

    runningProcesses.delete(id);
    return { success: true, message: 'Service stopped' };
  } else {
    return { success: true, message: 'Service was not running' };
  }
});

ipcMain.handle('service-status', async (event, { id }) => {
  const isRunning = runningProcesses.has(id);
  const data = runningProcesses.get(id);

  return {
    running: isRunning,
    logs: data?.logs?.slice(-20) || []
  };
});

// List all running services (used by frontend polling to detect online apps)
ipcMain.handle('services-list', async () => {
  const services = [];
  for (const [id, data] of runningProcesses) {
    services.push({ id, command: data.command, directory: data.directory });
  }
  return services;
});

// Helper function to kill all running processes synchronously
function killAllServices() {
  const { spawnSync } = require('child_process');

  console.log('\n🧹 Shutting down all services...');
  console.log(`   Found ${runningProcesses.size} running process(es)`);

  for (const [id, { process: proc }] of runningProcesses) {
    try {
      console.log(`   Killing [${id}] (PID: ${proc.pid})`);

      if (process.platform === 'win32') {
        // Use spawnSync for synchronous killing - ensures completion before app exits
        const result = spawnSync('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], {
          shell: true,
          timeout: 5000 // 5 second timeout
        });

        if (result.error) {
          console.error(`   Failed to kill [${id}]:`, result.error.message);
        } else {
          console.log(`   ✓ Killed [${id}]`);
        }
      } else {
        proc.kill('SIGKILL'); // Use SIGKILL for immediate termination
        console.log(`   ✓ Killed [${id}]`);
      }
    } catch (e) {
      console.error(`   Error killing [${id}]:`, e.message);
    }
  }

  runningProcesses.clear();
  // Clear BrowserView pool
  console.log('   Cleaning up BrowserView pool...');
  for (const [url, view] of browserViewPool) {
    if (mainWindow) {
      try { mainWindow.removeBrowserView(view); } catch (e) { }
    }
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  }
  browserViewPool.clear();
  currentViewUrl = null;

  console.log('   All services and views terminated.\n');
}

ipcMain.handle('open-antigravity', async (event, { directory }) => {
  if (!directory) return { success: false, error: 'Directory is required' };

  console.log(`\n🌌 Diagnostics: Attempting to open in Antigravity: "${directory}"`);

  try {
    const parent = path.dirname(directory);
    const folder = path.basename(directory);
    const { exec } = require('child_process');

    console.log(`   Parent Dir: ${parent}`);
    console.log(`   Folder Name: ${folder}`);

    // Check if antigravity is in PATH
    const whereCmd = process.platform === 'win32' ? `where antigravity` : `which antigravity`;
    exec(whereCmd, (err, stdout) => {
      if (err) console.error(`   ⚠️  'antigravity' command not found in PATH:`, err.message);
      else console.log(`   ✅ 'antigravity' found at: ${stdout.trim()}`);
    });

    // Based on user testing, running the full command or relative from parent works.
    // Let's try the full command with absolute path first, but using exec for simplicity.
    const fullCommand = `antigravity "${directory}"`;
    console.log(`   Executing: ${fullCommand}`);

    const childProcess = exec(fullCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`   ❌ Exec error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`   stderr: ${stderr}`);
        return;
      }
      console.log(`   stdout: ${stdout}`);
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to launch Antigravity process:', error);
    return { success: false, error: error.message };
  }
});

// Final cleanup handlers are already registered earlier in the file or managed by app.on('window-all-closed')
