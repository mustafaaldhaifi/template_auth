import { createHash, randomBytes } from 'node:crypto';

const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const sessionCookieName = 'auth_session';
type SessionRecord = { userId: string; expiresAt: number };
const sessionGlobal = globalThis as typeof globalThis & {
  authSessions?: Map<string, SessionRecord>;
};
// NOTE: A global store survives Next.js module reloads during local development.
const sessions = sessionGlobal.authSessions ??= new Map<string, SessionRecord>();

function tokenKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates an opaque local session with a fixed expiration.
 * 1. Remove expired entries from the local store.
 * 2. Generate a new random token and save only its digest.
 */
export function createSession(userId: string): string {
  // STEP 1: Bound growth from expired sessions during a long development run.
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(key);
  }
  // STEP 2: Keep the raw token only in the user's cookie.
  const token = randomBytes(32).toString('base64url');
  sessions.set(tokenKey(token), { userId, expiresAt: now + sessionLifetimeSeconds * 1000 });
  return token;
}

/** Removes a session immediately when its cookie token is supplied. */
export function invalidateSession(token: string | null): void {
  if (token) sessions.delete(tokenKey(token));
}

/** Returns the user for a live session, removing expired entries on access. */
export function getSessionUserId(token: string | null): string | null {
  if (!token) return null;
  const key = tokenKey(token);
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return session.userId;
}

/** Reads only the opaque session cookie from an incoming request. */
export function readSessionCookie(request: Request): string | null {
  const entry = request.headers.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  return entry ? entry.slice(sessionCookieName.length + 1) : null;
}

/** Builds a browser cookie that is inaccessible to client JavaScript. */
export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}${secure}`;
}

/** Expires the browser cookie after the server has invalidated its token. */
export function expiredSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
