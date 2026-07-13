import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

function copySpeechScriptsPlugin() {
  const speechFiles = ['speech-dictate.ps1', 'speech-dictate-check.ps1'] as const;
  return {
    name: 'copy-speech-scripts',
    closeBundle() {
      const outDir = resolve(__dirname, 'out/main');
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      for (const file of speechFiles) {
        copyFileSync(resolve(__dirname, 'electron/main', file), resolve(outDir, file));
      }
    },
  };
}

function copyHelpPlugin() {
  return {
    name: 'copy-help-assets',
    closeBundle() {
      const dest = resolve(__dirname, 'out/help');
      mkdirSync(dest, { recursive: true });
      cpSync(resolve(__dirname, 'electron/help'), dest, { recursive: true });
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySpeechScriptsPlugin(), copyHelpPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    server: {
      open: false,
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('shared'),
        '@sitescop/room-engine-core': resolve('shared/room-engine-core/src/index.ts'),
      },
    },
    plugins: [react()],
  },
});
