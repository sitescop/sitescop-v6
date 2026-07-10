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
      });
    } catch {
      // Fall back to standard headless Chrome if headless shell is unavailable.
    }
  }

  return puppeteer.launch({
    headless: true,
    executablePath: resolveChromeExecutable(),
    args: HIDDEN_BROWSER_ARGS,
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchPdfBrowser();
  }
  return browserPromise;
}

export async function htmlToPdfBuffer(
  html: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  const footerText = options.footerText?.trim() ?? '';
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });
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
    await page.close();
  }
}

export async function closePdfBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
}

export type { PdfRenderOptions } from './pdf-layout.js';
