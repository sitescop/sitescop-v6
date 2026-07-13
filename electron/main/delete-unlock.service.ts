import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Database as SqlDatabase } from 'sql.js';
import type { SessionUser } from '../../shared/api-types.js';
import { getUserById } from './database.js';
import { isSmtpSendReady, sendSmtpEmail } from './smtp.service.js';
import { getCompanySettings, getEmailSettings } from './settings.service.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const UNLOCK_TTL_MS = 10 * 60 * 1000;

export interface DeleteUnlockRequestResult {
  ok: boolean;
  message: string;
  maskedEmail?: string;
}

export interface DeleteUnlockVerifyResult {
  ok: boolean;
  message: string;
}

interface PendingCode {
  userId: string;
  codeHash: string;
  expiresAt: number;
}

let pendingCode: PendingCode | null = null;
let unlockedUntil = 0;
let unlockedUserId: string | null = null;

function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function makeDeleteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function clearDeleteUnlock(): void {
  pendingCode = null;
  unlockedUntil = 0;
  unlockedUserId = null;
}

export function isDeleteUnlocked(userId: string): boolean {
  return unlockedUserId === userId && Date.now() < unlockedUntil;
}

export async function requestDeleteUnlock(
  db: SqlDatabase,
  session: SessionUser,
  loginPassword: string,
): Promise<DeleteUnlockRequestResult> {
  const user = getUserById(db, session.id);
  if (!user) {
    return { ok: false, message: 'User not found.' };
  }

  const passwordOk = await bcrypt.compare(loginPassword, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, message: 'Login password is incorrect.' };
  }

  if (!isSmtpSendReady()) {
    return {
      ok: false,
      message:
        'SMTP is not ready. Open Settings → Email, enable SMTP, save, then try again.',
    };
  }

  const code = makeDeleteCode();
  pendingCode = {
    userId: user.id,
    codeHash: hashCode(code),
    expiresAt: Date.now() + CODE_TTL_MS,
  };
  unlockedUntil = 0;
  unlockedUserId = null;

  const company = getCompanySettings();
  const emailSettings = getEmailSettings();
  const sender = emailSettings.senderName || company.name || 'SiteScop';
  const minutes = Math.round(CODE_TTL_MS / 60000);

  const text = `Hello ${user.firstName || 'there'},

Someone requested a delete unlock code for SiteScop on this device.

Your delete password / code (valid for ${minutes} minutes):

${code}

Open SiteScop → Settings → Login & Password → Clear test data, then enter this code to open the delete window.

If you did not request this, ignore this email.

Kind regards,
${sender}`;

  try {
    await sendSmtpEmail({
      to: user.email,
      subject: 'SiteScop delete unlock code',
      text,
    });
  } catch (error) {
    pendingCode = null;
    const message = error instanceof Error ? error.message : 'Could not send delete unlock email.';
    return { ok: false, message };
  }

  return {
    ok: true,
    message: `Delete code sent to ${maskEmail(user.email)}. Check your inbox.`,
    maskedEmail: maskEmail(user.email),
  };
}

export function verifyDeleteUnlock(
  session: SessionUser,
  codeInput: string,
): DeleteUnlockVerifyResult {
  const code = codeInput.trim().toUpperCase();
  if (!code) {
    return { ok: false, message: 'Enter the delete code from your email.' };
  }
  if (!pendingCode || pendingCode.userId !== session.id) {
    return { ok: false, message: 'No delete code pending. Enter your login password and send a new code.' };
  }
  if (Date.now() > pendingCode.expiresAt) {
    pendingCode = null;
    return { ok: false, message: 'That delete code has expired. Request a new one.' };
  }
  if (pendingCode.codeHash !== hashCode(code)) {
    return { ok: false, message: 'Incorrect delete code.' };
  }

  pendingCode = null;
  unlockedUserId = session.id;
  unlockedUntil = Date.now() + UNLOCK_TTL_MS;

  return {
    ok: true,
    message: 'Delete window unlocked. You can archive all jobs and agreements, or Exit.',
  };
}
