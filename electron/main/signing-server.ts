import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import type { SignAgreementInput } from '../../shared/api-types.js';
import type { LocalDatabase } from './database.js';
import {
  getPublicAgreement,
  markAgreementViewed,
  signAgreement,
} from './agreements.service.js';
import { isGitHubSigningConfigured } from './settings.service.js';
import { SIGNING_PORTAL_HTML } from './signing-portal-html.js';

const DEFAULT_PORT = 38765;

let server: Server | null = null;
let portalBaseUrl = '';
let portalPort = DEFAULT_PORT;

export function getSigningPortalBaseUrl(): string {
  return portalBaseUrl;
}

export function getLanHostAddress(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

export function buildSigningUrl(token: string): string {
  const base = portalBaseUrl || `http://${getLanHostAddress()}:${portalPort}`;
  return `${base.replace(/\/$/, '')}/sign/${encodeURIComponent(token)}`;
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(new Error('Invalid request body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string, contentType: string) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function sendNoContent(res: ServerResponse) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

function parseTokenFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/sign\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function parseApiToken(pathname: string): string | null {
  const match = pathname.match(/^\/api\/sign\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  getStore: () => LocalDatabase,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (method === 'OPTIONS') {
    sendNoContent(res);
    return;
  }

  if (method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'sitescop-signing-portal' });
    return;
  }

  if (method === 'GET' && url.pathname.startsWith('/sign/')) {
    const token = parseTokenFromPath(url.pathname);
    if (!token) {
      sendText(res, 400, 'Invalid signing link.', 'text/plain; charset=utf-8');
      return;
    }
    sendText(res, 200, SIGNING_PORTAL_HTML, 'text/html; charset=utf-8');
    return;
  }

  if (method === 'GET' && url.pathname.startsWith('/api/sign/')) {
    const token = parseApiToken(url.pathname);
    if (!token) {
      sendJson(res, 400, { error: 'Invalid token' });
      return;
    }
    const store = getStore();
    const agreement = getPublicAgreement(store.db, token);
    if (!agreement) {
      sendJson(res, 404, { error: 'This agreement link is invalid or has expired.' });
      return;
    }
    sendJson(res, 200, agreement);
    return;
  }

  if (method === 'POST' && url.pathname.endsWith('/viewed')) {
    const token = parseApiToken(url.pathname.replace(/\/viewed$/, ''));
    if (!token) {
      sendJson(res, 400, { error: 'Invalid token' });
      return;
    }
    const store = getStore();
    markAgreementViewed(store.db, token);
    store.persist();
    if (isGitHubSigningConfigured()) {
      try {
        const { pushViewedAgreementToGitHub } = await import('./github-agreements.service.js');
        await pushViewedAgreementToGitHub(token);
      } catch {
        // Local viewed state is saved; GitHub mirror is best-effort.
      }
    }
    sendNoContent(res);
    return;
  }

  if (method === 'POST' && url.pathname.startsWith('/api/sign/')) {
    const token = parseApiToken(url.pathname);
    if (!token) {
      sendJson(res, 400, { error: 'Invalid token' });
      return;
    }
    try {
      const body = await readJsonBody<SignAgreementInput>(req);
      if (!body.declarationsAccepted) {
        sendJson(res, 400, { error: 'You must accept the declarations before signing.' });
        return;
      }
      const store = getStore();
      const result = await signAgreement(store.db, token, body);
      store.persist();
      if (isGitHubSigningConfigured()) {
        try {
          const { pushSignedAgreementToGitHub } = await import('./github-agreements.service.js');
          await pushSignedAgreementToGitHub(store.db, token, body);
        } catch {
          // Signature is stored locally; GitHub mirror is best-effort.
        }
      }
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed';
      sendJson(res, 400, { error: message });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

function listenOnPort(
  getStore: () => LocalDatabase,
  port: number,
): Promise<{ port: number; host: string }> {
  return new Promise((resolve, reject) => {
    const instance = createServer((req, res) => {
      void handleRequest(req, res, getStore).catch((error) => {
        const message = error instanceof Error ? error.message : 'Server error';
        sendJson(res, 500, { error: message });
      });
    });

    instance.on('error', reject);

    instance.listen(port, '0.0.0.0', () => {
      server = instance;
      portalPort = port;
      const host = getLanHostAddress();
      portalBaseUrl = `http://${host}:${port}`;
      resolve({ port, host });
    });
  });
}

export async function startSigningServer(
  getStore: () => LocalDatabase,
): Promise<{ baseUrl: string; port: number; host: string }> {
  if (server) {
    return { baseUrl: portalBaseUrl, port: portalPort, host: getLanHostAddress() };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = DEFAULT_PORT + attempt;
    try {
      const { host } = await listenOnPort(getStore, port);
      return { baseUrl: portalBaseUrl, port, host };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'EADDRINUSE' || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error('Could not start signing portal.');
}

export function stopSigningServer(): void {
  if (server) {
    server.close();
    server = null;
  }
  portalBaseUrl = '';
}
