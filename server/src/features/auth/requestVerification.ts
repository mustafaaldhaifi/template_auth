import { verifyTurnstileToken } from './turnstileVerification';

export type AuthVerificationAction = 'login' | 'signup' | 'forgot_password';

type VerificationFailure = {
  success: false;
  status: 400 | 503;
  error: { code: string; message: string; fieldErrors?: Record<string, string> };
};

export type VerificationResult = { success: true } | VerificationFailure;

const invalidToken: VerificationFailure = {
  success: false,
  status: 400,
  error: {
    code: 'VERIFICATION_FAILED',
    message: 'Security verification failed. Please try again.',
    fieldErrors: { verificationToken: 'Complete the security check again.' },
  },
};

const unavailable: VerificationFailure = {
  success: false,
  status: 503,
  error: {
    code: 'VERIFICATION_UNAVAILABLE',
    message: 'Security verification is temporarily unavailable. Please try again shortly.',
  },
};

/**
 * Dispatches a platform-neutral proof to its verifier before device access.
 * 1. Validate the proof method and token shape using request field names.
 * 2. Verify the currently supported web method with Cloudflare.
 * 3. Return a stable field error or retryable service error on failure.
 */
export async function verifyAuthRequest(body: unknown, action: AuthVerificationAction): Promise<VerificationResult> {
  // STEP 1: Keep the contract ready for native methods without accepting unknown proofs.
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const fieldErrors: Record<string, string> = {};
  if (fields.verificationMethod !== 'turnstile') {
    fieldErrors.verificationMethod = 'This security verification method is not supported.';
  }
  if (typeof fields.verificationToken !== 'string' ||
      fields.verificationToken.length === 0 || fields.verificationToken.length > 2048) {
    fieldErrors.verificationToken = 'Complete the security check.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      status: 400,
      error: { code: 'VALIDATION_ERROR', message: 'Please complete security verification.', fieldErrors },
    };
  }

  // STEP 2: Only Siteverify may authorize a web proof; native methods need their own verifier.
  const check = await verifyTurnstileToken(fields.verificationToken as string, action);

  // STEP 3: Provider failures are retryable; invalid proofs need a fresh token.
  if (check === 'unavailable') return unavailable;
  if (check === 'invalid') return invalidToken;
  return { success: true };
}
