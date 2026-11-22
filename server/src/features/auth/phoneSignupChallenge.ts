import { createHmac, timingSafeEqual } from 'node:crypto';
import { authCookie, expiredAuthCookie, readAuthCookie } from './authCookies';
import { createPasswordResetCode, createPasswordResetCodeSalt, getPasswordResetCodeSecret,
  hashPasswordResetCode, matchesPasswordResetCode } from './passwordResetToken';

const cookieName = 'phone_signup_challenge';
const lifetimeSeconds = 10 * 60;

type Challenge = {
  phone: string;
  countryId: number;
  channel: 'sms' | 'whatsapp';
  deviceId: string;
  codeHash: string;
  salt: string;
  expiresAt: number;
};

/** Signs a short-lived phone challenge without adding an unregistered user to the database. */
function signature(payload: string): string {
  return createHmac('sha256', getPasswordResetCodeSecret())
    .update('phone-signup:v1:').update(payload).digest('base64url');
}

/** Creates the same salted eight-digit code used by email recovery and binds it to a device. */
export function createPhoneSignupChallenge(
  request: Request, phone: string, countryId: number, channel: Challenge['channel'], deviceId: string,
): { code: string; cookie: string } {
  const code = createPasswordResetCode();
  const salt = createPasswordResetCodeSalt();
  const challenge: Challenge = {
    phone, countryId, channel, deviceId, salt,
    codeHash: hashPasswordResetCode(code, salt, getPasswordResetCodeSecret()),
    expiresAt: Date.now() + lifetimeSeconds * 1000,
  };
  const payload = Buffer.from(JSON.stringify(challenge)).toString('base64url');
  return { code, cookie: authCookie(cookieName, `${payload}.${signature(payload)}`, lifetimeSeconds, request) };
}

/**
 * Verifies the signed challenge, its device binding, expiry, phone, and submitted code.
 * 1. Authenticate the cookie before parsing its contents.
 * 2. Match the current request to the issued phone and device.
 * 3. Compare the salted code digest in constant time.
 */
export function verifyPhoneSignupChallenge(
  request: Request, phone: string, deviceId: string, code: string,
): { countryId: number; channel: Challenge['channel'] } | null {
  // STEP 1: Reject malformed or modified cookies before trusting their payload.
  const token = readAuthCookie(request, cookieName) ?? '';
  const [payload, providedSignature, extra] = token.split('.');
  if (!payload || !providedSignature || extra || token.length > 2048) return null;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const challenge = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Partial<Challenge>;
    // STEP 2: A challenge cannot be transferred to another phone or device.
    if (challenge.phone !== phone || challenge.deviceId !== deviceId ||
      typeof challenge.countryId !== 'number' || !Number.isInteger(challenge.countryId) ||
      (challenge.channel !== 'sms' && challenge.channel !== 'whatsapp') ||
      typeof challenge.expiresAt !== 'number' || challenge.expiresAt <= Date.now() ||
      typeof challenge.salt !== 'string' || typeof challenge.codeHash !== 'string') return null;
    // STEP 3: The code is never stored or compared in plaintext.
    return matchesPasswordResetCode(code, challenge.salt, challenge.codeHash, getPasswordResetCodeSecret())
      ? { countryId: challenge.countryId, channel: challenge.channel } : null;
  } catch {
    return null;
  }
}

/** Clears a consumed phone challenge after account creation. */
export function clearedPhoneSignupChallenge(request: Request): string {
  return expiredAuthCookie(cookieName, request);
}
