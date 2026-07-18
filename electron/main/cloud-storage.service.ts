import { createHash, createHmac } from 'node:crypto';
import { basename } from 'node:path';
import { readFileSync } from 'node:fs';
import type { CloudStorageTestResult } from '../../shared/api-types.js';
import {
  getCloudStorageSettings,
  getCloudStorageSettingsPublic,
  isCloudStorageUploadReady,
  type CloudStorageSettings,
} from './settings.service.js';

export interface CloudUploadResult {
  fileName: string;
  label: string;
  url: string;
  key: string;
  expiresInDays?: number;
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function amzDateNow(): { amzDate: string; dateStamp: string } {
  const now = new Date();
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function encodeS3Key(key: string): string {
  return key
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join('/');
}

/** RFC 3986 encode for query values (AWS SigV4). */
function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function buildObjectKey(settings: CloudStorageSettings, fileName: string): string {
  const safeName = basename(fileName).replace(/[^\w.\-()+ ]+/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${normalizePrefix(settings.s3Prefix)}${stamp}_${safeName}`;
}

function publicUrlForKey(settings: CloudStorageSettings, key: string): string {
  const base = settings.s3PublicBaseUrl.replace(/\/$/, '');
  return `${base}/${encodeS3Key(key).replace(/%2F/g, '/')}`;
}

function contentTypeForFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function createPresignedGetUrl(
  settings: CloudStorageSettings,
  key: string,
  fileName?: string,
): {
  url: string;
  expiresInDays: number;
} {
  const endpoint = settings.s3Endpoint.trim().replace(/\/$/, '');
  const bucket = settings.s3Bucket.trim();
  const region = settings.s3Region.trim() || 'auto';
  const service = 's3';
  const host = new URL(endpoint).host;
  const cappedDays = Math.min(7, Math.max(1, settings.linkExpiryDays || 7));
  const expiresSeconds = cappedDays * 24 * 60 * 60;
  const { amzDate, dateStamp } = amzDateNow();
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${settings.s3AccessKeyId}/${credentialScope}`;
  const canonicalUri = `/${encodeS3Key(bucket)}/${encodeS3Key(key)}`;
  const safeFileName = (fileName || basename(key)).replace(/[^\w.\-()+ ]+/g, '_');
  const isPdf = safeFileName.toLowerCase().endsWith('.pdf');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };

  // Helps phones open PDFs in the browser / Files app with a proper filename.
  if (isPdf) {
    query['response-content-type'] = 'application/pdf';
    query['response-content-disposition'] = `inline; filename="${safeFileName}"`;
  }

  const canonicalQueryString = Object.keys(query)
    .sort()
    .map((k) => `${awsEncode(k)}=${awsEncode(query[k]!)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = createHmac('sha256', signingKey(settings.s3SecretAccessKey, dateStamp, region, service))
    .update(stringToSign, 'utf8')
    .digest('hex');

  const url = `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  return { url, expiresInDays: cappedDays };
}

async function putObjectS3(settings: CloudStorageSettings, localPath: string): Promise<CloudUploadResult> {
  const endpoint = settings.s3Endpoint.trim().replace(/\/$/, '');
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    throw new Error('S3 endpoint must start with https://');
  }
  const bucket = settings.s3Bucket.trim();
  if (!bucket) throw new Error('S3 bucket is required.');

  const fileName = basename(localPath);
  const key = buildObjectKey(settings, fileName);
  const body = readFileSync(localPath);
  const { amzDate, dateStamp } = amzDateNow();
  const region = settings.s3Region.trim() || 'auto';
  const service = 's3';
  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodeS3Key(bucket)}/${encodeS3Key(key)}`;
  const payloadHash = sha256Hex(body);
  const contentType = contentTypeForFile(fileName);
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = createHmac(
    'sha256',
    signingKey(settings.s3SecretAccessKey, dateStamp, region, service),
  )
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${settings.s3AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${endpoint}${canonicalUri}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Host: host,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `S3 upload failed (${response.status}). ${text.slice(0, 240) || 'Check endpoint, bucket, and API keys.'}`,
    );
  }

  if (settings.useSignedDownloadLinks || !settings.s3PublicBaseUrl.trim()) {
    const signed = createPresignedGetUrl(settings, key, fileName);
    return {
      fileName,
      label: fileName,
      url: signed.url,
      key,
      expiresInDays: signed.expiresInDays,
    };
  }

  return {
    fileName,
    label: fileName,
    url: publicUrlForKey(settings, key),
    key,
  };
}

export async function uploadReportPdfs(localPaths: string[]): Promise<CloudUploadResult[]> {
  if (!isCloudStorageUploadReady()) {
    throw new Error('Cloud storage is not configured for uploads yet.');
  }
  const settings = getCloudStorageSettings();
  if (settings.provider !== 's3') {
    throw new Error(
      `Upload for ${settings.provider} is not connected yet. Switch to S3-compatible storage in Settings → Cloud storage, or leave cloud off.`,
    );
  }
  const results: CloudUploadResult[] = [];
  for (const path of localPaths) {
    results.push(await putObjectS3(settings, path));
  }
  return results;
}

export function formatReportLinks(uploads: CloudUploadResult[]): string {
  return uploads
    .map((u) => {
      const expiry =
        u.expiresInDays != null
          ? `\n(This download link expires in ${u.expiresInDays} day${u.expiresInDays === 1 ? '' : 's'}. Reply if you need a new link.)`
          : '';
      return `${u.label}\n${u.url}${expiry}`;
    })
    .join('\n\n');
}

export async function testCloudStorageConnection(): Promise<CloudStorageTestResult> {
  const publicSettings = getCloudStorageSettingsPublic();
  if (!publicSettings.enabled || publicSettings.provider === 'none') {
    return {
      ok: false,
      message: 'Enable cloud storage and choose a provider first.',
    };
  }
  if (!publicSettings.uploadReady) {
    return {
      ok: false,
      message: publicSettings.statusMessage,
    };
  }

  const settings = getCloudStorageSettings();
  if (settings.provider !== 's3') {
    return { ok: false, message: publicSettings.statusMessage };
  }

  const probeName = `sitescop-connection-test-${Date.now()}.txt`;
  const { writeFileSync, unlinkSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'sitescop-cloud-'));
  const probePath = join(dir, probeName);
  writeFileSync(probePath, 'SiteScop cloud storage connection test\n', 'utf8');
  try {
    const uploaded = await putObjectS3(settings, probePath);
    const mode = uploaded.expiresInDays
      ? `Temporary signed link (${uploaded.expiresInDays} day${uploaded.expiresInDays === 1 ? '' : 's'}). Bucket can stay private.`
      : 'Permanent public URL mode.';
    return {
      ok: true,
      message: `Upload succeeded to ${settings.s3Bucket}. ${mode}`,
      sampleUrl: uploaded.url,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      unlinkSync(probePath);
    } catch {
      /* ignore */
    }
  }
}

export { isCloudStorageUploadReady };
