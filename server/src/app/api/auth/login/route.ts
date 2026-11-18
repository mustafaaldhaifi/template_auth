import { authCorsHeaders } from '@/features/auth/authCors';
import type { LoginAccount } from '@/features/auth/loginRepository';
import { findLoginAccount } from '@/features/auth/loginRepository';
import { hashPassword } from '@/features/auth/passwordHash';
import { verifyPassword } from '@/features/auth/passwordVerify';
import { createSession, sessionCookie } from '@/features/auth/sessionStore';

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
 * 1. Find the account by normalized email.
 * 2. Spend comparable hashing work for unknown accounts.
 * 3. Return the account only when its password matches.
 */
async function authenticateLogin(input: LoginInput): Promise<LoginAccount | null> {
  // STEP 1: Look up the stored credential.
  const account = await findLoginAccount(input.email);
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

/** Returns public account details while placing the session token in an HttpOnly cookie. */
function loginSuccess(account: LoginAccount, request: Request, headers: Record<string, string>): Response {
  const token = createSession(account.id);
  return Response.json({ data: {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
  } }, { status: 200, headers: { ...headers, 'Set-Cookie': sessionCookie(token, request) } });
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/**
 * Validates credentials and creates a local browser session.
 * 1. Parse the request and return clear input errors.
 * 2. Authenticate credentials without exposing account existence.
 * 3. Return account data and a secure session cookie.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = authCorsHeaders(request);
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

  // STEP 2: Use a generic response for missing accounts and wrong passwords.
  try {
    const account = await authenticateLogin(validation.value);
    if (!account) {
      return loginError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.', headers);
    }

    // STEP 3: Issue an opaque cookie and omit the password hash from the response.
    return loginSuccess(account, request, headers);
  } catch (error) {
    console.error('Failed to sign in.', error);
    return loginError(500, 'INTERNAL_ERROR', 'We could not sign you in right now.', headers);
  }
}
