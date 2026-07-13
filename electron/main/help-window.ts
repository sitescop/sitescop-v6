/**
 * SiteScop V6 help window — searchable user guide + About.
 */
import { BrowserWindow, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

let helpWindow: BrowserWindow | null = null;

function helpHtmlPath(): string {
  const candidates = [
    join(__dirname, '../help/index.html'),
    join(__dirname, 'help/index.html'),
    join(app.getAppPath(), 'out/help/index.html'),
    join(process.cwd(), 'electron/help/index.html'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0];
}

export function openHelpWindow(section: 'guide' | 'about' = 'guide'): void {
  const htmlPath = helpHtmlPath();
  if (!existsSync(htmlPath)) {
    throw new Error(
      'Help files not found. Close SiteScop, run npm run build, then START-SITESCOP.bat again.',
    );
  }

  const title = section === 'about' ? 'SiteScop V6 — About us' : 'SiteScop V6 — Help';

  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.setTitle(title);
    helpWindow.focus();
    void helpWindow.loadFile(htmlPath, { hash: section });
    return;
  }

  helpWindow = new BrowserWindow({
    width: 1020,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    title,
    backgroundColor: '#0f2e24',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  helpWindow.setMenuBarVisibility(false);
  void helpWindow.loadFile(htmlPath, { hash: section });

  helpWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  helpWindow.on('closed', () => {
    helpWindow = null;
  });
}

export function openAboutWindow(): void {
  openHelpWindow('about');
}
