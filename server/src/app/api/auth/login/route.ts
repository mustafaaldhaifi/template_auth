import { authCorsHeaders } from '@/features/auth/authCors';
import { appendAuthCookie } from '@/features/auth/authCookies';
import { DeviceIssueLimitError } from '@/features/auth/deviceRepository';
import { resolveOrCreateDevice, withDeviceCookie, type DeviceIdentity } from '@/features/auth/deviceStore';
import type { LoginAccount } from '@/features/auth/loginRepository';
import { findLoginAccount } from '@/features/auth/loginRepository';
import { hashPassword } from '@/features/auth/passwordHash';
import { verifyPassword } from '@/features/auth/passwordVerify';
import { verifyAuthRequest } from '@/features/auth/requestVerification';
import { activeValueBlockSeconds, loadValueAttemptPolicy } from '@/features/auth/valueAttemptRepository';
import { createSession, sessionCookie } from '@/features/auth/sessionStore';
import { markRequestVerificationPassed, noteRequestValue, withApiRequestHistory } from '@/features/apiRequests/apiRequestHistory';
import { enforceApiRestriction } from '@/features/apiRequests/enforceApiRestriction';
import { withAuthCookieRenewal } from '@/features/auth/authCookieRenewal';

type LoginInput = { email: string; password: string };
type LoginValidation =
  | { success: true; value: LoginInput }
  | { success: false; fieldErrors: Record<string, string> };

/**
 * Validates and normalizes login fields.
 * 1. Read string values from the request body.
 * 2. Return field errors or normalized credentials.
 */
function validateLoginInput(body: unknown): LoginValidation {
  // STEP 1: Treat missing or non-string fields as empty values.
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  const password = typeof fields.password === 'string' ? fields.password : '';

  // STEP 2: Keep errors associated with their request fields.
  const fieldErrors: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    fieldErrors.email = 'Enter a valid email address.';
  }
  if (!password || password.length > 128) {
    fieldErrors.password = 'Enter a password of up to 128 characters.';
  }
  return Object.keys(fieldErrors).length > 0
    ? { success: false, fieldErrors }
    : { success: true, value: { email, password } };
}

/**
 * Verifies credentials without revealing whether an email exists.
 * 1. Use the account resolved after verification and the block check.
 * 2. Spend comparable hashing work for unknown accounts.
 * 3. Return the account only when its password matches.
 */
async function authenticateLogin(input: LoginInput, account: LoginAccount | null): Promise<LoginAccount | null> {
  // STEP 1: Use the already resolved account without another lookup.
  if (!account) {
    // STEP 2: Reduce timing differences for unknown emails.
    await hashPassword(input.password);
    return null;
  }
  // STEP 3: Give an incorrect password the same result as an unknown email.
  return await verifyPassword(input.password, account.passwordHash) ? account : null;
}

/** Formats login errors consistently with the API response contract. */
function loginError(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string>,
  fieldErrors?: Record<string, string>,
): Response {
  const error = fieldErrors ? { code, message, fieldErrors } : { code, message };
  return Response.json({ error }, { status, headers });
}

/** Returns public account details only after the device-bound session is stored. */
async function loginSuccess(
  account: LoginAccount,
  device: DeviceIdentity,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const token = await createSession(account.id, device.id, device.ipId);
  const response = Response.json({ data: {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
  } }, { status: 200, headers });
  appendAuthCookie(response, sessionCookie(token, request));
  return withDeviceCookie(response, device);
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/**
 * Validates credentials and creates a persistent device-bound session.
 * 1. Parse the request and return clear input errors.
 * 2. Verify the web proof before looking up or issuing a device.
 * 3. Enforce configured request limits before device or account work.
 * 4. Check any active value block before password work.
 * 5. Authenticate without exposing account existence and create a session only on success.
 */
async function handleLogin(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };
  // STEP 1: Reject malformed or invalid input before database access.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return loginError(400, 'INVALID_JSON', 'Send a valid JSON request body.', headers);
  }
  const validation = validateLoginInput(body);
  if (!validation.success) {
    return loginError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.',
      headers, validation.fieldErrors);
  }
  // STEP 2: Reject invalid or unavailable verification before touching device storage.
  const verification = await verifyAuthRequest(body, 'login');
  if (!verification.success) {
    return Response.json({ error: verification.error }, { status: verification.status, headers });
  }
  markRequestVerificationPassed();
  // STEP 3: A verified blocked request is recorded without touching device storage.
  const restriction = await enforceApiRestriction(request, headers);
  if (restriction) return restriction;

  // STEP 4: A value block applies to registered and unknown identifiers alike.
  let account: LoginAccount | null;
  let valuePolicy: Awaited<ReturnType<typeof loadValueAttemptPolicy>>;
  try {
    account = await findLoginAccount(validation.value.email);
    valuePolicy = await loadValueAttemptPolicy(validation.value.email, account?.id ?? null);
    const retryAfterSeconds = valuePolicy ? await activeValueBlockSeconds(valuePolicy) : null;
    if (retryAfterSeconds !== null) {
      return loginError(429, 'TOO_MANY_REQUESTS', 'Please wait before trying again.',
        { ...headers, 'Retry-After': String(retryAfterSeconds) });
    }
  } catch (error) {
    console.error('Failed to check login value limits.', error);
    return loginError(503, 'RESTRICTION_UNAVAILABLE', 'Please try again shortly.', headers);
  }

  // STEP 5: A verified but failed first attempt still receives a device cookie.
  let device: DeviceIdentity | null = null;
  try {
    device = await resolveOrCreateDevice(request);

    // STEP 6: Only finished password checks acquire a history value.
    const authenticated = await authenticateLogin(validation.value, account);
    // NOTE: Another request may have reached the limit while this password was being checked.
    const concurrentBlock = valuePolicy ? await activeValueBlockSeconds(valuePolicy) : null;
    if (concurrentBlock !== null) {
      return withDeviceCookie(loginError(429, 'TOO_MANY_REQUESTS', 'Please wait before trying again.',
        { ...headers, 'Retry-After': String(concurrentBlock) }), device);
    }
    if (!authenticated) {
      if (valuePolicy) noteRequestValue(valuePolicy);
      return withDeviceCookie(loginError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.', headers), device);
    }
    const response = await loginSuccess(authenticated, device, request, headers);
    if (valuePolicy) noteRequestValue(valuePolicy);
    return response;
  } catch (error) {
    if (error instanceof DeviceIssueLimitError) {
      return loginError(429, 'TOO_MANY_REQUESTS', 'Please wait before trying again.', headers);
    }
    console.error('Failed to sign in.', error);
    return withDeviceCookie(loginError(500, 'INTERNAL_ERROR', 'We could not sign you in right now.', headers), device);
  }
}

/** Renews eligible cookies and records the outcome of one login request. */
export function POST(request: Request): Promise<Response> {
  return withApiRequestHistory(request, () => withAuthCookieRenewal(request, () => handleLogin(request)));
}
