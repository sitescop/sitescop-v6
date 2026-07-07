import { app, BrowserWindow, Menu, dialog, shell, session } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDatabaseEmpty, openDatabase } from './database.js';
import { initIpcStore, registerIpcHandlers } from './ipc.js';
import { startSigningServer, stopSigningServer } from './signing-server.js';
import { syncSignedAgreementsFromGitHub } from './github-agreements.service.js';
import { getGitHubSettings, isGitHubSigningConfigured } from './settings.service.js';
import { closePdfBrowser } from './reports.service.js';
import { seedDatabase } from './seed.js';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

function preloadPath(): string {
  const base = join(__dirname, '../preload/index');
  if (existsSync(`${base}.mjs`)) return `${base}.mjs`;
  if (existsSync(`${base}.js`)) return `${base}.js`;
  return `${base}.mjs`;
}

function toggleDevTools() {
  if (!mainWindow) return;
  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow.webContents.openDevTools({ mode: 'bottom' });
  }
}

function buildAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        { type: 'separator' },
        {
          label: 'Quit SiteScop',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: toggleDevTools,
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About SiteScop V6',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'SiteScop V6',
              message: 'SiteScop V6 — Local Edition',
              detail:
                'This is the desktop app. Do not open SiteScop in Chrome or Edge.\n\nUse START-SITESCOP.bat or run: npm run dev',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function configureGeolocationPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'geolocation');
  });
  ses.setPermissionCheckHandler((_webContents, permission) => permission === 'geolocation');
}

function createWindow() {
  const preload = preloadPath();
  if (!existsSync(preload)) {
    dialog.showErrorBox(
      'SiteScop V6 — Missing files',
      `Preload script not found:\n${preload}\n\nRun: npm run build\nThen: npm run dev`,
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SiteScop V6 — Desktop App',
    show: false,
    backgroundColor: '#F4F7FA',
    autoHideMenuBar: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    dialog.showErrorBox('SiteScop V6', `Failed to load app (${code}): ${description}`);
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      toggleDevTools();
    }
  });

  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    ]);
    menu.popup({ window: mainWindow! });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const bootstrapExportToken = process.env.SITESCOP_BOOTSTRAP_EXPORT_TOKEN === '1';

const gotLock = bootstrapExportToken || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (bootstrapExportToken) {
      const token = getGitHubSettings().personalAccessToken.trim();
      if (token) process.stdout.write(token);
      app.quit();
      return;
    }

    buildAppMenu();
    configureGeolocationPermissions();

    try {
      registerIpcHandlers();
      const dbPath = join(app.getPath('userData'), 'sitescop-v6.db');
      const store = await openDatabase(dbPath);

      if (isDatabaseEmpty(store.db)) {
        await seedDatabase(store.db);
        store.persist();
      }

      initIpcStore(store);
      await startSigningServer(() => store);

      if (isGitHubSigningConfigured()) {
        const sync = () => {
          void syncSignedAgreementsFromGitHub(store.db).then(() => store.persist());
        };
        sync();
        setInterval(sync, 60_000);
      }

      createWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown startup error';
      dialog.showErrorBox('SiteScop V6 — Startup failed', message);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    stopSigningServer();
    void closePdfBrowser();
  });
}
