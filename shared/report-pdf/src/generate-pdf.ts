import fs from 'node:fs';
import puppeteer from 'puppeteer';
import {
  buildPdfFooterTemplate,
  PDF_PAGE_MARGINS,
  type PdfRenderOptions,
} from './pdf-layout.js';

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null;

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

const HIDDEN_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-position=-32000,-32000',
  '--window-size=1280,720',
];

function bundledChromePath(): string | null {
  try {
    const bundled = puppeteer.executablePath();
    return fileExists(bundled) ? bundled : null;
  } catch {
    return null;
  }
}

function resolveChromeExecutable(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && fileExists(fromEnv)) return fromEnv;

  const bundled = bundledChromePath();
  if (bundled) return bundled;

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }

  throw new Error(
    [
      'PDF generation needs Chrome or Edge.',
      'Install Google Chrome, or run this once in the SiteScop folder:',
      '  npx puppeteer browsers install chrome',
    ].join(' '),
  );
}

async function launchPdfBrowser() {
  const bundled = bundledChromePath();
  if (bundled) {
    try {
      return await puppeteer.launch({
        headless: 'shell',
        executablePath: bundled,
        args: HIDDEN_BROWSER_ARGS,
        protocolTimeout: 180_000,
      });
    } catch {
      // Fall back to standard headless Chrome if headless shell is unavailable.
    }
  }

  return puppeteer.launch({
    headless: true,
    executablePath: resolveChromeExecutable(),
    args: HIDDEN_BROWSER_ARGS,
    protocolTimeout: 180_000,
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchPdfBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

async function resetPdfBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Browser may already be dead after a crash.
  }
}

function isBrowserCrashError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /connection closed|target closed|session closed|browser.*closed|protocol error/i.test(
    message,
  );
}

async function renderPdfOnce(html: string, options: PdfRenderOptions): Promise<Buffer> {
  const footerText = options.footerText?.trim() ?? '';
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { ...PDF_PAGE_MARGINS },
      displayHeaderFooter: Boolean(footerText),
      headerTemplate: '<div></div>',
      footerTemplate: footerText ? buildPdfFooterTemplate(footerText) : '<div></div>',
    });
    return Buffer.from(pdf);
  } finally {
    try {
      if (!page.isClosed()) await page.close();
    } catch {
      // Ignore close failures after Chrome crashes.
    }
  }
}

export async function htmlToPdfBuffer(
  html: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  try {
    return await renderPdfOnce(html, options);
  } catch (error) {
    if (!isBrowserCrashError(error)) throw error;

    // Dead browser instance — relaunch once and retry.
    await resetPdfBrowser();
    try {
      return await renderPdfOnce(html, options);
    } catch (retryError) {
      await resetPdfBrowser();
      if (isBrowserCrashError(retryError)) {
        throw new Error(
          'PDF generation failed because Chrome crashed (often caused by very large inspection photos). Try again after the app restarts, or reduce photo size/count.',
        );
      }
      throw retryError;
    }
  }
}

export async function closePdfBrowser(): Promise<void> {
  await resetPdfBrowser();
}

export type { PdfRenderOptions } from './pdf-layout.js';
