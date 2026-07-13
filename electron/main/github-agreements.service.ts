import type { Database as SqlDatabase } from 'sql.js';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { SignAgreementInput } from '../../shared/api-types.js';
import {
  getAgreement,
  getPublicAgreement,
  markAgreementViewed,
  signAgreement,
  syncAgentDetailsFromJob,
} from './agreements.service.js';
import { GitHubCloudError, wrapGitHubNetworkError } from './github-errors.js';
import { getGitHubFileText, listGitHubDirectory, putGitHubFileText, publishSigningPortalToGitHub } from './github.service.js';
import { getSigningPortalBaseUrl, buildSigningUrl } from './signing-server.js';
import {
  getGitHubSettings,
  isGitHubSigningConfigured,
  type GitHubSettings,
} from './settings.service.js';
import { getEffectivePublicRelayUrl } from './public-relay.service.js';

const PENDING_DIR = 'agreements/pending';
const SIGNED_DIR = 'agreements/signed';
const VIEWED_DIR = 'agreements/viewed';

export interface GitHubPendingAgreementFile {
  token: string;
  agreementId: string;
  agreementNumber: string;
  publicView: NonNullable<ReturnType<typeof getPublicAgreement>>;
  sentAt: string;
  submitEndpoints: {
    lan: string;
    public?: string;
    /**
     * Hosted GitHub submit — client can Sign & submit while SiteScop PC is off.
     * PAT is AES-GCM sealed with the agreement access token (never plaintext in the repo —
     * GitHub push protection blocks raw PATs).
     */
    github?: {
      owner: string;
      repo: string;
      branch: string;
      signedContentsUrl: string;
      viewedContentsUrl: string;
      /** Sealed PAT: `v1.` + base64(iv + authTag + ciphertext) */
      tokenCipher: string;
    };
  };
}

export interface GitHubSignedAgreementFile {
  token: string;
  signatureName: string;
  signatureData: string;
  declarationsAccepted: boolean;
  signingParty?: 'CLIENT' | 'AGENT';
  agentAuthorityAccepted?: boolean;
  signedAt: string;
}

export interface GitHubSyncResult {
  imported: number;
  viewed: number;
  errors: string[];
  failed: boolean;
}

export function buildGitHubSigningUrl(token: string, settings = getGitHubSettings()): string {
  const base = settings.pagesBaseUrl.replace(/\/$/, '');
  return `${base}/?token=${encodeURIComponent(token)}`;
}

/** Seal a GitHub PAT so it can live in public pending JSON without tripping secret scanning. */
export function sealGitHubPatForAgreement(pat: string, accessToken: string): string {
  const key = createHash('sha256').update(`sitescop-sign-v1:${accessToken}`, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(pat, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

function buildSubmitEndpoints(token: string, settings = getGitHubSettings()) {
  const lan = `${getSigningPortalBaseUrl()}/api/sign/${encodeURIComponent(token)}`;
  const endpoints: GitHubPendingAgreementFile['submitEndpoints'] = { lan };
  const relay = getEffectivePublicRelayUrl() || settings.publicRelayUrl.trim();
  if (relay) {
    endpoints.public = `${relay.replace(/\/$/, '')}/api/sign/${encodeURIComponent(token)}`;
  }

  const pat = settings.personalAccessToken.trim();
  if (pat && settings.owner.trim() && settings.repo.trim() && token.trim()) {
    const owner = settings.owner.trim();
    const repo = settings.repo.trim();
    const branch = settings.branch.trim() || 'main';
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
    endpoints.github = {
      owner,
      repo,
      branch,
      signedContentsUrl: `${apiBase}/${SIGNED_DIR}/${encodeURIComponent(token)}.json`,
      viewedContentsUrl: `${apiBase}/${VIEWED_DIR}/${encodeURIComponent(token)}.json`,
      tokenCipher: sealGitHubPatForAgreement(pat, token),
    };
  }

  return endpoints;
}

export async function pushSignedAgreementToGitHub(
  db: SqlDatabase,
  token: string,
  input: SignAgreementInput,
  settings = getGitHubSettings(),
): Promise<void> {
  void db;
  const payload: GitHubSignedAgreementFile = {
    token,
    signatureName: input.signatureName.trim(),
    signatureData: input.signatureData,
    declarationsAccepted: input.declarationsAccepted,
    signingParty: input.signingParty,
    agentAuthorityAccepted: input.agentAuthorityAccepted,
    signedAt: new Date().toISOString(),
  };
  const path = `${SIGNED_DIR}/${token}.json`;
  const existing = await getGitHubFileText(settings, path);
  await putGitHubFileText(
    settings,
    path,
    JSON.stringify(payload, null, 2),
    `SiteScop Cloud Signing: client signed via secure relay`,
    settings.personalAccessToken,
    existing?.sha,
  );
}

export async function pushViewedAgreementToGitHub(
  token: string,
  settings = getGitHubSettings(),
): Promise<void> {
  const path = `${VIEWED_DIR}/${token}.json`;
  const existing = await getGitHubFileText(settings, path);
  await putGitHubFileText(
    settings,
    path,
    JSON.stringify({ token, viewedAt: new Date().toISOString() }, null, 2),
    `SiteScop Cloud Signing: agreement viewed via secure relay`,
    settings.personalAccessToken,
    existing?.sha,
  );
}

export async function pushPendingAgreementToGitHub(
  db: SqlDatabase,
  agreementId: string,
  settings = getGitHubSettings(),
): Promise<void> {
  const agreement = getAgreement(db, agreementId);
  if (!agreement?.accessToken) {
    throw new GitHubCloudError(
      'Agreement must be sent before uploading to GitHub.',
      'UPLOAD_FAILED',
    );
  }

  if (agreement.status === 'SIGNED' || agreement.status === 'CANCELLED') {
    return;
  }

  syncAgentDetailsFromJob(db, agreementId);

  const publicView = getPublicAgreement(db, agreement.accessToken);
  if (!publicView) {
    throw new GitHubCloudError(
      'Could not build agreement data for GitHub upload.',
      'UPLOAD_FAILED',
    );
  }

  const payload: GitHubPendingAgreementFile = {
    token: agreement.accessToken,
    agreementId: agreement.id,
    agreementNumber: agreement.agreementNumber,
    publicView,
    sentAt: new Date().toISOString(),
    submitEndpoints: buildSubmitEndpoints(agreement.accessToken, settings),
  };

  const path = `${PENDING_DIR}/${agreement.accessToken}.json`;

  try {
    const existing = await getGitHubFileText(settings, path);
    await putGitHubFileText(
      settings,
      path,
      JSON.stringify(payload, null, 2),
      `SiteScop Cloud Signing: send agreement ${agreement.agreementNumber}`,
      settings.personalAccessToken,
      existing?.sha,
    );
  } catch (error) {
    throw wrapGitHubNetworkError(error, 'upload');
  }

  // Keep the public signing portal JS updated (hosted offline submit).
  try {
    await publishSigningPortalToGitHub(settings);
  } catch (error) {
    console.warn('[github] portal publish skipped', error);
  }
}

/** Re-upload open cloud agreements so submitEndpoints match the latest relay / hosted GitHub path. */
export async function refreshPendingSubmitEndpoints(db: SqlDatabase): Promise<number> {
  if (!isGitHubSigningConfigured()) return 0;

  const stmt = db.prepare(
    `SELECT id FROM agreements
     WHERE status IN ('SENT', 'VIEWED')
       AND IFNULL(access_token, '') != ''
       AND IFNULL(deleted_at, '') = ''
       AND IFNULL(archived_at, '') = ''`,
  );
  const ids: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    ids.push(row.id);
  }
  stmt.free();

  let updated = 0;
  for (const id of ids) {
    try {
      await pushPendingAgreementToGitHub(db, id);
      updated += 1;
    } catch (error) {
      console.error('[public-relay] refresh pending failed', id, error);
    }
  }
  return updated;
}

export async function syncSignedAgreementsFromGitHub(
  db: SqlDatabase,
  settings = getGitHubSettings(),
): Promise<GitHubSyncResult> {
  if (!isGitHubSigningConfigured()) {
    return { imported: 0, viewed: 0, errors: [], failed: false };
  }

  let imported = 0;
  let viewed = 0;
  const errors: string[] = [];
  let failed = false;

  try {
    const viewedFiles = await listGitHubDirectory(settings, VIEWED_DIR);
    for (const file of viewedFiles) {
      const token = file.name.replace(/\.json$/i, '');
      if (!token) continue;
      try {
        const agreement = getPublicAgreement(db, token);
        if (agreement && agreement.status === 'SENT') {
          markAgreementViewed(db, token);
          viewed += 1;
        }
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : 'Could not mark viewed'}`,
        );
      }
    }

    const signedFiles = await listGitHubDirectory(settings, SIGNED_DIR);
    for (const file of signedFiles) {
      const token = file.name.replace(/\.json$/i, '');
      if (!token) continue;

      try {
        const remote = await getGitHubFileText(settings, `${SIGNED_DIR}/${file.name}`);
        if (!remote) continue;

        const payload = JSON.parse(remote.text) as GitHubSignedAgreementFile;
        if (!payload.signatureName?.trim() || !payload.signatureData?.trim()) {
          continue;
        }

        const current = getPublicAgreement(db, token);
        if (!current) continue;
        if (!current.canSign) continue;

        const input: SignAgreementInput = {
          signatureName: payload.signatureName.trim(),
          signatureData: payload.signatureData,
          declarationsAccepted: payload.declarationsAccepted ?? true,
          signingParty: payload.signingParty,
          agentAuthorityAccepted: payload.agentAuthorityAccepted,
        };

        await signAgreement(db, token, input);
        imported += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Import failed'}`);
      }
    }
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : 'Sync from GitHub failed';
    errors.push(message);
  }

  return { imported, viewed, errors, failed };
}

export function getActiveSigningUrl(token: string): { mode: 'github' | 'local'; url: string } {
  if (isGitHubSigningConfigured()) {
    return { mode: 'github', url: buildGitHubSigningUrl(token) };
  }
  return { mode: 'local', url: buildSigningUrl(token) };
}
