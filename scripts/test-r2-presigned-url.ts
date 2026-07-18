/**
 * Smoke-test SigV4 query-string signed GET URL shape (no network).
 * Run: npx tsx scripts/test-r2-presigned-url.ts
 */
import { createHash, createHmac } from 'node:crypto';

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3Key(key: string): string {
  return key
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join('/');
}

function createPresignedGetUrl(opts: {
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  expiresSeconds: number;
}): string {
  const endpoint = opts.endpoint.replace(/\/$/, '');
  const host = new URL(endpoint).host;
  const service = 's3';
  const amzDate = '20260718T050000Z';
  const dateStamp = '20260718';
  const credentialScope = `${dateStamp}/${opts.region}/${service}/aws4_request`;
  const credential = `${opts.accessKeyId}/${credentialScope}`;
  const canonicalUri = `/${encodeS3Key(opts.bucket)}/${encodeS3Key(opts.key)}`;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(opts.expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQueryString = Object.keys(query)
    .sort()
    .map((k) => `${awsEncode(k)}=${awsEncode(query[k]!)}`)
    .join('&');
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${opts.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

const url = createPresignedGetUrl({
  endpoint: 'https://example.r2.cloudflarestorage.com',
  bucket: 'sitescop-reports',
  key: 'sitescop-reports/demo.pdf',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret',
  region: 'auto',
  expiresSeconds: 7 * 24 * 60 * 60,
});

const checks = [
  url.startsWith('https://example.r2.cloudflarestorage.com/sitescop-reports/'),
  url.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'),
  url.includes('X-Amz-Expires=604800'),
  url.includes('X-Amz-Signature='),
  !url.includes('pub-'),
];

if (checks.every(Boolean)) {
  console.log('OK: private signed URL shape looks correct');
  console.log(url.slice(0, 120) + '…');
  process.exit(0);
}

console.error('FAIL: unexpected signed URL shape');
console.error(url);
process.exit(1);
