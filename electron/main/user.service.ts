import bcrypt from 'bcryptjs';
import type { Database as SqlDatabase } from 'sql.js';
import type { ChangePasswordInput, InspectorProfileInput, SessionUser } from '../../shared/api-types.js';
import { getUserByEmail, getUserById, toSessionUser } from './database.js';

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
  db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
}
