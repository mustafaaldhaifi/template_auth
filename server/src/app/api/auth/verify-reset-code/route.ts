import { authCorsHeaders } from '@/features/auth/authCors';
import { verifyPasswordResetCode } from '@/features/auth/passwordResetRepository';
import { createPasswordResetToken, getPasswordResetCodeSecret, hashPasswordResetToken, passwordResetLifetimeMinutes } from '@/features/auth/passwordResetToken';
import { validateVerifyResetCodeInput } from '@/features/auth/passwordResetValidation';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/** Returns the same error for unknown accounts and invalid, expired, or used codes. */
function invalidCode(headers: Record<string, string>): Response {
  return Response.json({
    error: {
      code: 'INVALID_RESET_CODE',
      message: 'This code is invalid or expired.',
      fieldErrors: { code: 'Check the code or request a new one.' },
    },
  }, { status: 400, headers });
}

/**
 * Verifies an emailed code and issues a one-time password-change grant.
 * 1. Parse and validate the email and numeric code.
 * 2. Exchange the valid code for a short-lived bearer grant.
 * 3. Return the grant only after the database commits the exchange.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };

  // STEP 1: Reject malformed or field-invalid input before accessing storage.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Send a valid JSON request body.' } },
      { status: 400, headers },
    );
  }
  const validation = validateVerifyResetCodeInput(body);
  if (!validation.success) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors } },
      { status: 400, headers },
    );
  }

  try {
    // STEP 2: Keep the raw grant out of storage and never place it in a URL.
    const secret = getPasswordResetCodeSecret();
    const token = createPasswordResetToken();
    const grantHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + passwordResetLifetimeMinutes * 60_000);
    const verified = await verifyPasswordResetCode(
      validation.value.email, validation.value.code, secret, grantHash, expiresAt,
    );
    if (!verified) return invalidCode(headers);

    // STEP 3: Only the caller receives the raw grant for the password-change request.
    return Response.json({ data: { token } }, { status: 200, headers });
  } catch (error) {
    console.error('Failed to verify a password recovery code.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not verify the code right now.' } },
      { status: 500, headers },
    );
  }
}
