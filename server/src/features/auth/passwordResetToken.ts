import { createHash, randomBytes } from 'node:crypto';

export const passwordResetLifetimeMinutes = 30;

/** Creates an unpredictable token that is sent only to the account's email. */
export function createPasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Returns the database key without storing the bearer token itself. */
export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
