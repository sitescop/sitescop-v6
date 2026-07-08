import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function hasSystemBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.some(fileExists);
}

function hasBundledChrome() {
  try {
    return fileExists(puppeteer.executablePath());
  } catch {
    return false;
  }
}

if (hasBundledChrome() || hasSystemBrowser()) {
  console.log('[sitescop] PDF browser ready (Chrome/Edge found).');
  process.exit(0);
}

console.log('[sitescop] Downloading Chrome for PDF reports (one-time, ~150 MB)...');
const result = spawnSync(
  process.execPath,
  ['node_modules/puppeteer/lib/cjs/puppeteer/node/cli.js', 'browsers', 'install', 'chrome'],
  { cwd: rootDir, stdio: 'inherit' },
);

if (result.status !== 0) {
  console.warn('[sitescop] Could not download Chrome for PDFs. Install Google Chrome or Edge on this PC.');
  process.exit(0);
}

console.log('[sitescop] Chrome installed for PDF generation.');
