import { app, BrowserWindow, Menu, dialog, shell, session, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDatabaseEmpty, openDatabase } from './database.js';
import { initIpcStore, registerIpcHandlers } from './ipc.js';
import { startSigningServer, stopSigningServer } from './signing-server.js';
import { refreshPendingSubmitEndpoints, syncSignedAgreementsFromGitHub } from './github-agreements.service.js';
import { getGitHubSettings, isGitHubSigningConfigured } from './settings.service.js';
import { closePdfBrowser } from './reports.service.js';
import { seedDatabase } from './seed.js';
import { openAboutWindow, openHelpWindow } from './help-window.js';
import { startReminderScheduler, stopReminderScheduler } from './reminders.service.js';
import {
  startPublicRelayTunnel,
  stopPublicRelayTunnel,
} from './public-relay.service.js';

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

function toggleFullScreen() {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
}

function exitFullScreenIfNeeded() {
  if (!mainWindow?.isFullScreen()) return false;
  mainWindow.setFullScreen(false);
  return true;
}

function openHelpSafe(section: 'guide' | 'about' = 'guide') {
  try {
    if (section === 'about') openAboutWindow();
    else openHelpWindow('guide');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not open Help.';
    dialog.showErrorBox('SiteScop V6 Help', message);
  }
}

function buildAppMenu() {
  // Custom green AppMenuBar in the UI is the only visible menu.
  // Keep keyboard shortcuts via before-input-event / app IPC — not a second native bar.
  Menu.setApplicationMenu(null);
}

function registerAppMenuIpc() {
  ipcMain.handle('app:toggleFullscreen', async () => toggleFullScreen());
  ipcMain.handle('app:exitFullscreen', async () => exitFullScreenIfNeeded());
  ipcMain.handle('app:isFullscreen', async () => Boolean(mainWindow?.isFullScreen()));
  ipcMain.handle('app:reload', async () => {
    mainWindow?.webContents.reload();
  });
  ipcMain.handle('app:quit', async () => {
    app.quit();
  });
  ipcMain.handle('app:openHelp', async () => {
    openHelpSafe('guide');
  });
  ipcMain.handle('app:openAbout', async () => {
    openHelpSafe('about');
  });
  ipcMain.handle('app:zoom', async (_event, direction: 'in' | 'out' | 'reset') => {
    if (!mainWindow) return;
    const contents = mainWindow.webContents;
    if (direction === 'reset') {
      contents.setZoomLevel(0);
      return;
    }
    const current = contents.getZoomLevel();
    contents.setZoomLevel(direction === 'in' ? current + 0.5 : current - 0.5);
  });
  ipcMain.handle(
    'app:edit',
    async (_event, action: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll') => {
      if (!mainWindow) return;
      const contents = mainWindow.webContents;
      if (action === 'undo') contents.undo();
      else if (action === 'redo') contents.redo();
      else if (action === 'cut') contents.cut();
      else if (action === 'copy') contents.copy();
      else if (action === 'paste') contents.paste();
      else if (action === 'selectAll') contents.selectAll();
    },
  );
}

function configureSpellCheck() {
  const ses = session.defaultSession;
  ses.setSpellCheckerLanguages(['en-AU', 'en-GB', 'en-US']);
}

function configureAppPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'geolocation' || permission === 'media');
  });
  ses.setPermissionCheckHandler(
    (_webContents, permission) => permission === 'geolocation' || permission === 'media',
  );
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
      spellcheck: true,
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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') {
      toggleDevTools();
      return;
    }
    if (input.key === 'F11') {
      toggleFullScreen();
      event.preventDefault();
      return;
    }
    if (input.key === 'F1') {
      openHelpSafe('guide');
      event.preventDefault();
      return;
    }
    if (input.key === 'Escape' && mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false);
      event.preventDefault();
      return;
    }
    const ctrl = input.control || input.meta;
    if (ctrl && input.key.toLowerCase() === 'r' && !input.alt) {
      mainWindow?.webContents.reload();
      event.preventDefault();
      return;
    }
    if (ctrl && input.key.toLowerCase() === 'q') {
      app.quit();
      event.preventDefault();
      return;
    }
    if (ctrl && (input.key === '=' || input.key === '+')) {
      const level = mainWindow?.webContents.getZoomLevel() ?? 0;
      mainWindow?.webContents.setZoomLevel(level + 0.5);
      event.preventDefault();
      return;
    }
    if (ctrl && input.key === '-') {
      const level = mainWindow?.webContents.getZoomLevel() ?? 0;
      mainWindow?.webContents.setZoomLevel(level - 0.5);
      event.preventDefault();
      return;
    }
    if (ctrl && input.key === '0') {
      mainWindow?.webContents.setZoomLevel(0);
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('context-menu', (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = [];

    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 6)) {
        template.push({
          label: suggestion,
          click: () => mainWindow?.webContents.replaceMisspelling(suggestion),
        });
      }
      template.push({ type: 'separator' });
      template.push({
        label: `Add "${params.misspelledWord}" to dictionary`,
        click: () => {
          mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
        },
      });
      template.push({ type: 'separator' });
    }

    template.push(
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    );

    Menu.buildFromTemplate(template).popup({ window: mainWindow! });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const bootstrapExportToken = process.env.SITESCOP_BOOTSTRAP_EXPORT_TOKEN === '1';

const gotLock = bootstrapExportToken || app.requestSingleInstanceLock();
if (!gotLock) {
  console.error('\nSiteScop is already running. Check the taskbar for the SiteScop V6 window.\n');
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
    registerAppMenuIpc();
    configureSpellCheck();
    configureAppPermissions();

    try {
      registerIpcHandlers();
      const dbPath = join(app.getPath('userData'), 'sitescop-v6.db');
      const store = await openDatabase(dbPath);

      if (isDatabaseEmpty(store.db)) {
        await seedDatabase(store.db);
        store.persist();
      }

      try {
        const { repairIncompletePropertyAddresses } = await import('./property-address.js');
        const repaired = repairIncompletePropertyAddresses(store.db);
        if (repaired.repairedJobs > 0 || repaired.repairedAgreements > 0) {
          console.warn(
            `[data-repair] Restored incomplete property addresses (jobs=${repaired.repairedJobs}, agreements=${repaired.repairedAgreements}).`,
          );
          store.persist();
          if (repaired.jobIds.length > 0) {
            void (async () => {
              try {
                const { generateAgreementPdfForId } = await import('./agreements.service.js');
                const placeholders = repaired.jobIds.map(() => '?').join(', ');
                const agrStmt = store.db.prepare(
                  `SELECT id FROM agreements
                   WHERE job_id IN (${placeholders})
                     AND IFNULL(deleted_at, '') = ''`,
                );
                agrStmt.bind(repaired.jobIds);
                const ids: string[] = [];
                while (agrStmt.step()) {
                  ids.push(String((agrStmt.getAsObject() as { id: string }).id));
                }
                agrStmt.free();
                for (const agreementId of ids) {
                  try {
                    await generateAgreementPdfForId(store.db, agreementId);
                  } catch (error) {
                    console.warn('[data-repair] could not regenerate agreement PDF', agreementId, error);
                  }
                }
                const { generateInvoicePdfForJob } = await import('./invoices.service.js');
                for (const jobId of repaired.jobIds) {
                  try {
                    await generateInvoicePdfForJob(store.db, jobId);
                  } catch (error) {
                    console.warn('[data-repair] could not regenerate invoice PDF', jobId, error);
                  }
                }
                store.persist();
              } catch (error) {
                console.warn('[data-repair] PDF regeneration skipped', error);
              }
            })();
          }
        }
      } catch (error) {
        console.warn('[data-repair] property address repair failed', error);
      }

      initIpcStore(store);
      const signing = await startSigningServer(() => store);
      startReminderScheduler(() => store.db, () => store.persist());

      if (isGitHubSigningConfigured()) {
        void (async () => {
          try {
            const { publishSigningPortalToGitHub } = await import('./github.service.js');
            await publishSigningPortalToGitHub(getGitHubSettings());
          } catch (error) {
            console.warn('[github] portal publish on startup failed', error);
          }

          const publicUrl = await startPublicRelayTunnel(signing.port);
          if (!publicUrl) {
            console.warn(
              '[public-relay] Optional tunnel not started (hosted GitHub submit still works offline).',
            );
          }
          try {
            await refreshPendingSubmitEndpoints(store.db);
            store.persist();
          } catch (error) {
            console.error('[github] could not refresh pending agreements', error);
          }
        })();

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
    stopReminderScheduler();
    stopPublicRelayTunnel({ clearSession: true });
    stopSigningServer();
    void closePdfBrowser();
  });
}

void isDev;
