import { createHash, randomBytes } from 'node:crypto';

/** Issues a high-entropy bearer value kept only in the client's cookie. */
export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Stores and looks up only the SHA-256 digest of an opaque cookie token. */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Rejects malformed bearer values before database lookups. */
export function isOpaqueToken(token: string | null): token is string {
  return Boolean(token && /^[A-Za-z0-9_-]{43}$/.test(token));
}
