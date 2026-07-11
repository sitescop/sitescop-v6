import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Database as SqlDatabase } from 'sql.js';
import type {
  ChangePasswordInput,
  InspectorProfileInput,
  PasswordResetConfirmInput,
  PasswordResetRequestResult,
  SessionUser,
} from '../../shared/api-types.js';
import { getUserByEmail, getUserById, toSessionUser } from './database.js';
import { isSmtpSendReady, sendSmtpEmail } from './smtp.service.js';
import { getCompanySettings, getEmailSettings } from './settings.service.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function updateInspectorProfile(
  db: SqlDatabase,
  userId: string,
  input: InspectorProfileInput,
): SessionUser {
  const current = getUserById(db, userId);
  if (!current) throw new Error('User not found.');

  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Enter a valid email address.');

  const existing = getUserByEmail(db, email);
  if (existing && existing.id !== userId) {
    throw new Error('That email is already used by another account.');
  }

  db.run(
    `UPDATE users SET
       first_name = ?,
       last_name = ?,
       email = ?,
       company_name = ?,
       mobile = ?
     WHERE id = ?`,
    [
      input.firstName.trim(),
      input.lastName.trim(),
      email,
      input.companyName.trim(),
      input.mobile?.trim() || null,
      userId,
    ],
  );

  const updated = getUserById(db, userId);
  if (!updated) throw new Error('Could not load updated profile.');
  return toSessionUser(updated);
}

export async function changeInspectorPassword(
  db: SqlDatabase,
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = getUserById(db, userId);
  if (!user) throw new Error('User not found.');

  const currentOk = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!currentOk) throw new Error('Current password is incorrect.');

  if (input.newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.');
  }
  if (input.newPassword !== input.confirmPassword) {
    throw new Error('New password and confirmation do not match.');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  db.run(
    `UPDATE users SET
       password_hash = ?,
       password_reset_token_hash = NULL,
       password_reset_expires_at = NULL
     WHERE id = ?`,
    [passwordHash, userId],
  );
}

/**
 * Always returns a generic success message when the email format is valid,
 * to avoid revealing whether an account exists. Sends mail only if the user exists.
 */
export async function requestPasswordReset(
  db: SqlDatabase,
  emailInput: string,
): Promise<PasswordResetRequestResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email.includes('@')) {
    return { ok: false, message: 'Enter a valid email address.' };
  }

  if (!isSmtpSendReady()) {
    return {
      ok: false,
      message:
        'SMTP email is not configured. Open Settings → Email, enable SMTP, save your Zoho/Gmail settings, then try again.',
    };
  }

  const user = getUserByEmail(db, email);
  const genericOk: PasswordResetRequestResult = {
    ok: true,
    message:
      'If that email is registered on this device, a password reset message has been sent. Check your inbox.',
  };

  if (!user) {
    return genericOk;
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  db.run(
    `UPDATE users SET
       password_reset_token_hash = ?,
       password_reset_expires_at = ?
     WHERE id = ?`,
    [tokenHash, expiresAt, user.id],
  );

  const company = getCompanySettings();
  const emailSettings = getEmailSettings();
  const sender = emailSettings.senderName || company.name || 'SiteScop';
  const minutes = Math.round(RESET_TOKEN_TTL_MS / 60000);

  const text = `Hello ${user.firstName || 'there'},

We received a request to reset your SiteScop password.

Your reset code (valid for ${minutes} minutes):

${token}

Open SiteScop V6 → Forgot password → Enter reset code, then paste this code and choose a new password.

If you did not request this, you can ignore this email.

Kind regards,
${sender}`;

  try {
    await sendSmtpEmail({
      to: user.email,
      subject: 'SiteScop password reset',
      text,
    });
  } catch (error) {
    db.run(
      `UPDATE users SET password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ?`,
      [user.id],
    );
    const message = error instanceof Error ? error.message : 'Could not send reset email.';
    return { ok: false, message };
  }

  return genericOk;
}

export async function confirmPasswordReset(
  db: SqlDatabase,
  input: PasswordResetConfirmInput,
): Promise<PasswordResetRequestResult> {
  const email = input.email.trim().toLowerCase();
  const token = input.token.trim();
  if (!email.includes('@') || !token) {
    return { ok: false, message: 'Email and reset code are required.' };
  }
  if (input.newPassword.length < 8) {
    return { ok: false, message: 'New password must be at least 8 characters.' };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, message: 'New password and confirmation do not match.' };
  }

  const user = getUserByEmail(db, email);
  if (!user) {
    return { ok: false, message: 'Invalid or expired reset code.' };
  }

  const stmt = db.prepare(
    `SELECT password_reset_token_hash AS tokenHash, password_reset_expires_at AS expiresAt
     FROM users WHERE id = ? LIMIT 1`,
  );
  stmt.bind([user.id]);
  if (!stmt.step()) {
    stmt.free();
    return { ok: false, message: 'Invalid or expired reset code.' };
  }
  const row = stmt.getAsObject() as { tokenHash?: string | null; expiresAt?: string | null };
  stmt.free();

  const storedHash = row.tokenHash ? String(row.tokenHash) : '';
  const expiresAt = row.expiresAt ? String(row.expiresAt) : '';
  if (!storedHash || !expiresAt) {
    return { ok: false, message: 'Invalid or expired reset code.' };
  }
  if (new Date(expiresAt).getTime() < Date.now()) {
    db.run(
      `UPDATE users SET password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ?`,
      [user.id],
    );
    return { ok: false, message: 'This reset code has expired. Request a new one.' };
  }
  if (storedHash !== hashResetToken(token)) {
    return { ok: false, message: 'Invalid or expired reset code.' };
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  db.run(
    `UPDATE users SET
       password_hash = ?,
       password_reset_token_hash = NULL,
       password_reset_expires_at = NULL
     WHERE id = ?`,
    [passwordHash, user.id],
  );

  return { ok: true, message: 'Password updated. You can sign in with your new password.' };
}
