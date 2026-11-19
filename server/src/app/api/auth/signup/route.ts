import { authCorsHeaders } from '@/features/auth/authCors';
import { DeviceIssueLimitError } from '@/features/auth/deviceRepository';
import { resolveOrCreateDevice, withDeviceCookie, type DeviceIdentity } from '@/features/auth/deviceStore';
import { hashPassword } from '@/features/auth/passwordHash';
import { verifyAuthRequest } from '@/features/auth/requestVerification';
import { createSignupAccount } from '@/features/auth/signupRepository';
import { validateSignupInput } from '@/features/auth/signupValidation';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/**
 * Validates a sign-up request and creates its account records.
 * 1. Parse and validate the JSON body, returning field errors when needed.
 * 2. Verify the web proof before issuing or reusing a device.
 * 3. Hash the password and create all account rows in one transaction.
 * 4. Return account data or a stable duplicate-email/server error response.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };
  // STEP 1: Reject malformed JSON and invalid fields before accessing the database.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Send a valid JSON request body.' } },
      { status: 400, headers },
    );
  }
  const validation = validateSignupInput(body);
  if (!validation.success) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please correct the highlighted fields.',
          fieldErrors: validation.fieldErrors,
        },
      },
      { status: 400, headers },
    );
  }

  // STEP 2: Do not create device, IP, or account records for an unverified request.
  const verification = await verifyAuthRequest(body, 'signup');
  if (!verification.success) {
    return Response.json({ error: verification.error }, { status: verification.status, headers });
  }

  // STEP 3: A verified first request gets a device whether signup succeeds or fails.
  const { firstName, lastName, email, password } = validation.value;
  let device: DeviceIdentity | null = null;
  try {
    device = await resolveOrCreateDevice(request);

    // STEP 4: Keep all account writes in their existing transaction.
    const passwordHash = await hashPassword(password);
    const id = await createSignupAccount({ firstName, lastName, email, passwordHash });
    return withDeviceCookie(Response.json(
      { data: { id, firstName, lastName, email } },
      { status: 201, headers },
    ), device);
  } catch (error) {
    if (error instanceof DeviceIssueLimitError) {
      return Response.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Please wait before trying again.' } },
        { status: 429, headers },
      );
    }
    // STEP 5: Translate the email constraint without exposing database details.
    if (error && typeof error === 'object' && 'code' in error &&
      'constraint' in error && error.code === '23505' &&
      error.constraint === 'user_emails_email_key') {
      return withDeviceCookie(Response.json(
        {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists.',
            fieldErrors: { email: 'This email address is already registered.' },
          },
        },
        { status: 409, headers },
      ), device);
    }
    console.error('Failed to create a sign-up account.', error);
    return withDeviceCookie(Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not create your account right now.' } },
      { status: 500, headers },
    ), device);
  }
}
