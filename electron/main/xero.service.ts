import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { shell } from 'electron';
import type { Database as SqlDatabase } from 'sql.js';
import type { PushToXeroResult } from '../../shared/api-types.js';
import { getJobDetail } from './jobs.service.js';
import {
  clearXeroConnection,
  getXeroSettings,
  isXeroConnected,
  saveXeroTokens,
  type XeroSettings,
} from './settings.service.js';

const XERO_CALLBACK_PORT = 53682;
const XERO_REDIRECT_URI = `http://localhost:${XERO_CALLBACK_PORT}/xero/callback`;
const XERO_SCOPES = [
  'offline_access',
  'accounting.transactions',
  'accounting.contacts',
  'accounting.settings.read',
  'openid',
  'profile',
  'email',
].join(' ');

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function waitForXeroCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${XERO_CALLBACK_PORT}`);
      if (url.pathname !== '/xero/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<html><body style="font-family:sans-serif;padding:2rem"><h1>SiteScop connected to Xero</h1><p>You can close this window and return to SiteScop.</p></body></html>',
      );
      server.close();

      if (error) {
        reject(new Error(`Xero authorization failed: ${error}`));
        return;
      }
      if (!code) {
        reject(new Error('Xero did not return an authorization code.'));
        return;
      }
      resolve(code);
    });

    server.listen(XERO_CALLBACK_PORT, '127.0.0.1', () => {
      // listening
    });
    server.on('error', (err) => {
      server.close();
      reject(err);
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Xero sign-in timed out. Please try again.'));
    }, 120_000);
  });
}

async function exchangeAuthorizationCode(
  settings: XeroSettings,
  code: string,
  verifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: XERO_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error_description || payload.error || 'Could not complete Xero sign-in.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? 1800,
  };
}

async function refreshAccessToken(settings: XeroSettings): Promise<XeroSettings> {
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: settings.refreshToken,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Xero session expired. Connect again in Settings.');
  }

  const next = {
    ...settings,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || settings.refreshToken,
    tokenExpiresAt: Date.now() + (payload.expires_in ?? 1800) * 1000,
  };
  saveXeroTokens(next);
  return next;
}

async function ensureFreshXeroSettings(): Promise<XeroSettings> {
  let settings = getXeroSettings();
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('Add your Xero app Client ID and Secret in Settings first.');
  }
  if (!settings.refreshToken) {
    throw new Error('Connect to Xero in Settings before sending invoices.');
  }
  if (Date.now() >= settings.tokenExpiresAt - 60_000) {
    settings = await refreshAccessToken(settings);
  }
  return settings;
}

async function fetchXeroConnections(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string }>> {
  const response = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const payload = (await response.json()) as Array<{ tenantId?: string; tenantName?: string }>;
  if (!response.ok) {
    throw new Error('Could not read your Xero organisations.');
  }
  return payload
    .filter((row) => row.tenantId && row.tenantName)
    .map((row) => ({ tenantId: row.tenantId!, tenantName: row.tenantName! }));
}

export async function connectXero(): Promise<{ tenantName: string }> {
  const settings = getXeroSettings();
  if (!settings.clientId.trim() || !settings.clientSecret.trim()) {
    throw new Error('Enter your Xero Client ID and Client Secret in Settings, then save before connecting.');
  }

  const { verifier, challenge } = generatePkce();
  const state = base64UrlEncode(randomBytes(16));
  const authorizeUrl = new URL('https://login.xero.com/identity/connect/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', settings.clientId.trim());
  authorizeUrl.searchParams.set('redirect_uri', XERO_REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', XERO_SCOPES);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const callbackPromise = waitForXeroCallback();
  await shell.openExternal(authorizeUrl.toString());
  const code = await callbackPromise;

  const tokens = await exchangeAuthorizationCode(settings, code, verifier);
  const connections = await fetchXeroConnections(tokens.accessToken);
  if (!connections.length) {
    throw new Error('No Xero organisation found for this account.');
  }

  const tenant = connections[0];
  saveXeroTokens({
    ...settings,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  });

  return { tenantName: tenant.tenantName };
}

export function disconnectXero(): void {
  clearXeroConnection();
}

function inspectionDescription(type: string, address: string): string {
  const label =
    type === 'PEST' ? 'Pest inspection' : type === 'COMBINED' ? 'Building & pest inspection' : 'Building inspection';
  return `${label} — ${address}`;
}

function dueDateFromToday(days = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function loadAgreementTotals(
  db: SqlDatabase,
  jobId: string,
): Promise<{ priceCents: number; gstCents: number; totalCents: number } | null> {
  const stmt = db.prepare(
    `
    SELECT price_cents AS priceCents, gst_cents AS gstCents, total_cents AS totalCents
    FROM agreements
    WHERE job_id = ?
      AND status = 'SIGNED'
      AND IFNULL(deleted_at, '') = ''
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return {
    priceCents: Number(row.priceCents ?? 0),
    gstCents: Number(row.gstCents ?? 0),
    totalCents: Number(row.totalCents ?? 0),
  };
}

export async function pushJobInvoiceToXero(db: SqlDatabase, jobId: string): Promise<PushToXeroResult> {
  if (!isXeroConnected()) {
    throw new Error('Connect to Xero in Settings before sending invoices.');
  }

  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found.');
  if (job.agreementStatus !== 'SIGNED') {
    throw new Error('Only signed jobs can be sent to Xero.');
  }

  const pricing = await loadAgreementTotals(db, jobId);
  if (!pricing || pricing.totalCents <= 0) {
    throw new Error('This job has no signed agreement price to send to Xero.');
  }

  const settings = await ensureFreshXeroSettings();
  const unitAmount = pricing.priceCents / 100;
  const today = new Date().toISOString().slice(0, 10);

  const body = {
    Invoices: [
      {
        Type: 'ACCREC',
        Contact: {
          Name: job.clientName,
          EmailAddress: job.email || undefined,
        },
        Date: today,
        DueDate: dueDateFromToday(7),
        InvoiceNumber: job.jobNumber,
        Reference: job.jobNumber,
        LineAmountTypes: 'Exclusive',
        Status: job.paymentReceived ? 'PAID' : 'AUTHORISED',
        LineItems: [
          {
            Description: inspectionDescription(job.inspectionType, job.propertyAddress),
            Quantity: 1,
            UnitAmount: unitAmount,
            TaxAmount: pricing.gstCents / 100,
            AccountCode: settings.salesAccountCode,
          },
        ],
      },
    ],
  };

  const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      'xero-tenant-id': settings.tenantId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    Invoices?: Array<{ InvoiceID?: string; InvoiceNumber?: string }>;
    Message?: string;
    Elements?: Array<{ ValidationErrors?: Array<{ Message?: string }> }>;
  };

  if (!response.ok) {
    const validation =
      payload.Elements?.[0]?.ValidationErrors?.map((item) => item.Message).filter(Boolean).join(' ') ||
      payload.Message;
    throw new Error(validation || 'Xero rejected the invoice. Check your sales account code in Settings.');
  }

  const invoice = payload.Invoices?.[0];
  if (!invoice?.InvoiceID) {
    throw new Error('Xero did not return an invoice ID.');
  }

  db.run(
    `UPDATE jobs SET xero_invoice_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [invoice.InvoiceID, jobId],
  );

  return {
    invoiceId: invoice.InvoiceID,
    invoiceNumber: invoice.InvoiceNumber || job.jobNumber,
    tenantName: settings.tenantName,
    message: `Invoice sent to Xero (${settings.tenantName}).`,
  };
}

export function getXeroRedirectUri(): string {
  return XERO_REDIRECT_URI;
}
