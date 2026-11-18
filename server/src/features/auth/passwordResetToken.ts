import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const passwordResetLifetimeMinutes = 10;
export const passwordResetCodeLength = 8;

/** Generates an eight-digit decimal code, including leading zeroes. */
export function createPasswordResetCode(): string {
  return randomInt(100_000_000).toString().padStart(passwordResetCodeLength, '0');
}

/** Gives each low-entropy code an independent salt. */
export function createPasswordResetCodeSalt(): string {
  return randomBytes(16).toString('hex');
}

/** Reads a server-only key so a database leak does not reveal short codes. */
export function getPasswordResetCodeSecret(): Buffer {
  const secret = process.env.PASSWORD_RESET_CODE_SECRET?.trim() ?? '';
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('PASSWORD_RESET_CODE_SECRET must be 64 hexadecimal characters.');
  }
  return Buffer.from(secret, 'hex');
}

/** Hashes the short code with its salt and a server-only HMAC key. */
export function hashPasswordResetCode(code: string, salt: string, secret: Buffer): string {
  return createHmac('sha256', secret).update(salt).update(':').update(code).digest('hex');
}

/** Compares fixed-size digests without exposing matching prefixes. */
export function matchesPasswordResetCode(code: string, salt: string, storedHash: string, secret: Buffer): boolean {
  const candidate = Buffer.from(hashPasswordResetCode(code, salt, secret), 'hex');
  const stored = /^[0-9a-f]{64}$/i.test(storedHash) ? Buffer.from(storedHash, 'hex') : Buffer.alloc(32);
  return timingSafeEqual(candidate, stored);
}

/** Creates an unpredictable grant only after the emailed code is verified. */
export function createPasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Returns the database key without storing the bearer token itself. */
export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
