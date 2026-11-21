import { authCookie, expiredAuthCookie, readAuthCookie } from './authCookies';
import { hashOpaqueToken, isOpaqueToken, newOpaqueToken } from './authTokens';
import { requestDeviceTokenHash } from './deviceStore';
import { findActiveSessionUserId, insertSession, revokeSession } from './sessionRepository';
import { noteRequestDevice, noteRequestSession } from '@/features/apiRequests/apiRequestHistory';
import { sessionLifetimeSeconds } from './authLifetime';

const sessionCookieName = 'auth_session';

/**
 * Creates an opaque persistent session only after successful authentication.
 * 1. Generate a fresh high-entropy token and initial inactivity expiry.
 * 2. Persist its digest with the authenticated user and device.
 * 3. Associate the new session ID with this request's audit record.
 */
export async function createSession(userId: string, deviceId: string, loginIpId: string | null): Promise<string> {
  // STEP 1: A fresh session never reuses the pre-authentication device token.
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);

  // STEP 2: Only a completed database write may yield a session cookie.
  const sessionId = await insertSession(hashOpaqueToken(token), userId, deviceId, loginIpId, expiresAt);
  // STEP 3: Never log a session that failed to persist.
  noteRequestSession(sessionId);
  return token;
}

/** Removes the current session from use while retaining its database record. */
export async function invalidateSession(token: string | null): Promise<void> {
  if (isOpaqueToken(token)) await revokeSession(hashOpaqueToken(token));
}

/** Checks the session and device cookies together on every protected request. */
export async function getSessionUserId(request: Request): Promise<string | null> {
  const sessionToken = readSessionCookie(request);
  const deviceTokenHash = requestDeviceTokenHash(request);
  if (!isOpaqueToken(sessionToken) || !deviceTokenHash) return null;
  const session = await findActiveSessionUserId(hashOpaqueToken(sessionToken), deviceTokenHash);
  if (!session) return null;
  noteRequestDevice(session.deviceId, null);
  noteRequestSession(session.sessionId);
  return session.userId;
}

/** Reads only the opaque session cookie from an incoming request. */
export function readSessionCookie(request: Request): string | null {
  return readAuthCookie(request, sessionCookieName);
}

/** Builds a session cookie that is inaccessible to client JavaScript. */
export function sessionCookie(token: string, request: Request): string {
  return authCookie(sessionCookieName, token, sessionLifetimeSeconds, request);
}

/** Expires the browser's session cookie after server-side revocation. */
export function expiredSessionCookie(request: Request): string {
  return expiredAuthCookie(sessionCookieName, request);
}
