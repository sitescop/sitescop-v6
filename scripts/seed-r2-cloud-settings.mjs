/**
 * Seeds SiteScop AppData settings.json with private R2 cloud defaults (no secrets).
 * Optional env to also store credentials (encrypted only when saved via the app — this
 * script stores a plaintext secret only if SITESCOP_R2_SECRET is set; prefer entering
 * the secret in Settings → Cloud storage so Electron safeStorage encrypts it).
 *
 * Env (optional):
 *   SITESCOP_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *   SITESCOP_R2_ACCESS_KEY_ID=...
 *   SITESCOP_R2_SECRET=...
 *   SITESCOP_R2_BUCKET=sitescop-reports
 *
 * Run: node scripts/seed-r2-cloud-settings.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const settingsPath = join(homedir(), 'AppData', 'Roaming', 'SiteScop V6', 'settings.json');

const endpoint = (process.env.SITESCOP_R2_ENDPOINT || '').trim();
const accessKeyId = (process.env.SITESCOP_R2_ACCESS_KEY_ID || '').trim();
const secret = (process.env.SITESCOP_R2_SECRET || '').trim();
const bucket = (process.env.SITESCOP_R2_BUCKET || 'sitescop-reports').trim();

const hasKeys = Boolean(endpoint && accessKeyId && secret);

let raw = {};
if (existsSync(settingsPath)) {
  try {
    raw = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    raw = {};
  }
}

const existing = raw.cloudStorage || {};

raw.cloudStorage = {
  ...existing,
  enabled: hasKeys ? true : Boolean(existing.enabled),
  provider: 's3',
  preferLinksOverAttachments: true,
  useSignedDownloadLinks: true,
  linkExpiryDays: 7,
  s3Endpoint: endpoint || existing.s3Endpoint || '',
  s3Region: 'auto',
  s3Bucket: bucket,
  s3AccessKeyId: accessKeyId || existing.s3AccessKeyId || '',
  s3PublicBaseUrl: '',
  s3Prefix: 'sitescop-reports/',
  accountEmail: existing.accountEmail || '',
  notes: existing.notes || 'Private R2 signed links for inspection report PDFs.',
};

if (secret) {
  // Plaintext until next Save in Settings (Electron safeStorage encrypts on save).
  raw.cloudStorage.s3SecretAccessKey = secret;
  delete raw.cloudStorage.encryptedS3SecretAccessKey;
  console.warn(
    'Secret stored temporarily in settings.json. Open SiteScop → Settings → Cloud storage → Save to encrypt with safeStorage.',
  );
}

writeFileSync(settingsPath, JSON.stringify(raw, null, 2), 'utf8');

console.log(`Updated ${settingsPath}`);
console.log(
  hasKeys
    ? 'Cloud storage seeded with endpoint/access key. Open SiteScop → Settings → Cloud storage, paste Secret, Save, then Test.'
    : 'Cloud storage defaults seeded (private signed links, bucket sitescop-reports). Fill endpoint + keys in Settings → Cloud storage.',
);
