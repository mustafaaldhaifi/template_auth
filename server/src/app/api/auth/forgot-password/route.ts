import { authCorsHeaders } from '@/features/auth/authCors';
import { getPasswordResetMailConfig, sendPasswordResetEmail } from '@/features/auth/passwordResetEmail';
import { deletePasswordResetToken, findPasswordResetAccount, issuePasswordResetToken } from '@/features/auth/passwordResetRepository';
import { createPasswordResetToken, hashPasswordResetToken, passwordResetLifetimeMinutes } from '@/features/auth/passwordResetToken';
import { validateForgotPasswordInput } from '@/features/auth/passwordResetValidation';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/** Returns API errors without exposing account or delivery details. */
function requestError(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string>,
  fieldErrors?: Record<string, string>,
): Response {
  const error = fieldErrors ? { code, message, fieldErrors } : { code, message };
  return Response.json({ error }, { status, headers });
}

/**
 * Requests a one-time password reset link without revealing account existence.
 * 1. Parse and validate the submitted email.
 * 2. Create a short-lived token for an eligible account.
 * 3. Deliver the link and return the same success response for known and unknown emails.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };

  // STEP 1: Reject malformed input before touching delivery or storage.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return requestError(400, 'INVALID_JSON', 'Send a valid JSON request body.', headers);
  }
  const validation = validateForgotPasswordInput(body);
  if (!validation.success) {
    return requestError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.',
      headers, validation.fieldErrors);
  }

  try {
    // STEP 2: Validate configuration for every request before looking up an email.
    const mailConfig = getPasswordResetMailConfig();
    const account = await findPasswordResetAccount(validation.value.email);
    if (!account) return new Response(null, { status: 204, headers });

    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + passwordResetLifetimeMinutes * 60_000);
    const issued = await issuePasswordResetToken(account.userId, tokenHash, expiresAt);
    if (!issued) return new Response(null, { status: 204, headers });

    // STEP 3: Mail failures are logged but never disclose whether an account exists.
    try {
      await sendPasswordResetEmail(mailConfig, account.email, token);
    } catch (error) {
      // NOTE: SMTP diagnostics must not print the reset URL or bearer token.
      const deliveryCode = error && typeof error === 'object' && 'code' in error
        ? error.code : 'UNKNOWN';
      console.error('Failed to deliver a password reset link.', deliveryCode);
      try {
        await deletePasswordResetToken(tokenHash);
      } catch (cleanupError) {
        console.error('Failed to remove an undelivered password reset token.', cleanupError);
      }
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    console.error('Failed to request a password reset.', error);
    return requestError(500, 'INTERNAL_ERROR', 'We could not process your request right now.', headers);
  }
}
