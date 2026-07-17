import { join } from 'node:path';

function userDataPath() {
  return process.env.SITESCOP_VERIFY_USERDATA ?? join(process.cwd(), '.verify-userdata');
}

export const app = {
  getPath(name) {
    const base = userDataPath();
    if (name === 'userData') return base;
    if (name === 'temp') return join(base, 'temp');
    return base;
  },
  getAppPath() {
    return process.cwd();
  },
  isPackaged: false,
};

export const shell = {
  openPath: async () => '',
  openExternal: async () => {},
};

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString(value) {
    return Buffer.from(value, 'utf8');
  },
  decryptString(buffer) {
    return buffer.toString('utf8');
  },
};

export const BrowserWindow = class {};
export const Menu = { buildFromTemplate: () => ({}), setApplicationMenu: () => {} };
export const dialog = { showErrorBox: () => {}, showMessageBox: async () => ({}) };
export const ipcMain = { handle: () => {} };
export const contextBridge = { exposeInMainWorld: () => {} };
export const ipcRenderer = { invoke: async () => null };

/** Minimal stub so PDF photo compression can import electron outside the app. */
export const nativeImage = {
  createFromDataURL() {
    return {
      isEmpty: () => true,
      getSize: () => ({ width: 0, height: 0 }),
      resize: () => this,
      toJPEG: () => Buffer.alloc(0),
    };
  },
};
