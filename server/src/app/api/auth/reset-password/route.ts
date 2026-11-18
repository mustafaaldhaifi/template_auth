import { authCorsHeaders } from '@/features/auth/authCors';
import { hashPassword } from '@/features/auth/passwordHash';
import { consumePasswordResetToken, hasActivePasswordResetToken } from '@/features/auth/passwordResetRepository';
import { hashPasswordResetToken } from '@/features/auth/passwordResetToken';
import { validateResetPasswordInput } from '@/features/auth/passwordResetValidation';
import { expiredSessionCookie, invalidateUserSessions } from '@/features/auth/sessionStore';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/** Returns the same token error for missing, used, and expired links. */
function invalidToken(headers: Record<string, string>): Response {
  return Response.json({
    error: {
      code: 'INVALID_RESET_TOKEN',
      message: 'This reset link is invalid or expired.',
      fieldErrors: { token: 'Request a new password reset link.' },
    },
  }, { status: 400, headers });
}

/**
 * Sets a new password after the user presents a valid reset token.
 * 1. Parse and validate the token and new password fields.
 * 2. Verify the token before hashing, then change the password atomically.
 * 3. Clear local sessions and return an empty success response.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };

  // STEP 1: Keep malformed and field-specific errors in the standard API shape.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Send a valid JSON request body.' } },
      { status: 400, headers },
    );
  }
  const validation = validateResetPasswordInput(body);
  if (!validation.success) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors } },
      { status: 400, headers },
    );
  }

  // STEP 2: Reject stale links without spending password-hashing work.
  try {
    const tokenHash = hashPasswordResetToken(validation.value.token);
    if (!await hasActivePasswordResetToken(tokenHash)) return invalidToken(headers);

    const passwordHash = await hashPassword(validation.value.password);
    const userId = await consumePasswordResetToken(tokenHash, passwordHash);
    if (!userId) return invalidToken(headers);

    // STEP 3: Remove this process's sessions after the database commits.
    invalidateUserSessions(userId);
    return new Response(null, {
      status: 204,
      headers: { ...headers, 'Set-Cookie': expiredSessionCookie(request) },
    });
  } catch (error) {
    console.error('Failed to reset a password.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not reset your password right now.' } },
      { status: 500, headers },
    );
  }
}
