type FieldErrors = Record<string, string>;

export type ForgotPasswordInput = { email: string };
export type VerifyResetCodeInput = { email: string; code: string };
export type ResetPasswordInput = { token: string; password: string };

export type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false; fieldErrors: FieldErrors };

/** Validates and normalizes the email used to request a recovery code. */
export function validateForgotPasswordInput(body: unknown): ValidationResult<ForgotPasswordInput> {
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return { success: false, fieldErrors: { email: 'Enter a valid email address.' } };
  }
  return { success: true, value: { email } };
}

/**
 * Validates an email and exactly eight numeric code digits.
 * 1. Normalize the email using the request validator.
 * 2. Report code format errors on the code field.
 */
export function validateVerifyResetCodeInput(body: unknown): ValidationResult<VerifyResetCodeInput> {
  // STEP 1: Keep email validation consistent with the code-request endpoint.
  const emailResult = validateForgotPasswordInput(body);
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const code = typeof fields.code === 'string' ? fields.code : '';

  // STEP 2: Preserve leading zeroes and reject non-digit input.
  const fieldErrors: FieldErrors = emailResult.success ? {} : { ...emailResult.fieldErrors };
  if (!/^[0-9]{8}$/.test(code)) {
    fieldErrors.code = 'Enter the eight-digit code from your email.';
  }
  return emailResult.success && Object.keys(fieldErrors).length === 0
    ? { success: true, value: { email: emailResult.value.email, code } }
    : { success: false, fieldErrors };
}

/**
 * Validates the reset token and matching new password fields.
 * 1. Read only string values from the request body.
 * 2. Associate invalid token and password values with their fields.
 * 3. Return the validated token and password without the confirmation.
 */
export function validateResetPasswordInput(body: unknown): ValidationResult<ResetPasswordInput> {
  // STEP 1: Treat missing or non-string fields as empty input.
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const token = typeof fields.token === 'string' ? fields.token : '';
  const password = typeof fields.password === 'string' ? fields.password : '';
  const confirmPassword = typeof fields.confirmPassword === 'string' ? fields.confirmPassword : '';

  // STEP 2: Match the existing sign-up password requirements.
  const fieldErrors: FieldErrors = {};
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    fieldErrors.token = 'Request a new recovery code.';
  }
  if (password.length < 8 || password.length > 128) {
    fieldErrors.password = 'Use a password between 8 and 128 characters.';
  }
  if (!confirmPassword || confirmPassword !== password) {
    fieldErrors.confirmPassword = 'Passwords must match.';
  }

  // STEP 3: The confirmation is checked but never sent to storage.
  return Object.keys(fieldErrors).length > 0
    ? { success: false, fieldErrors }
    : { success: true, value: { token, password } };
}
