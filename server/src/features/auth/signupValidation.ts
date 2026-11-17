export type SignupInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type SignupFieldErrors = Partial<Record<keyof SignupInput, string>>;

type SignupValidationResult =
  | { success: true; value: SignupInput }
  | { success: false; fieldErrors: SignupFieldErrors };

/**
 * Validates and normalizes a sign-up request before any database write.
 * 1. Read only the expected string fields from the request body.
 * 2. Check names and email, then password and confirmation.
 * 3. Return field errors or normalized account details.
 */
export function validateSignupInput(body: unknown): SignupValidationResult {
  // STEP 1: Treat non-object bodies and non-string fields as invalid input.
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const firstName = typeof fields.firstName === 'string' ? fields.firstName.trim() : '';
  const lastName = typeof fields.lastName === 'string' ? fields.lastName.trim() : '';
  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  const password = typeof fields.password === 'string' ? fields.password : '';
  const confirmPassword = typeof fields.confirmPassword === 'string'
    ? fields.confirmPassword
    : '';
  const fieldErrors: SignupFieldErrors = {};

  // STEP 2: Match the form's field rules and bound stored values to useful lengths.
  if (!firstName || firstName.length > 100) {
    fieldErrors.firstName = 'Enter a first name of up to 100 characters.';
  }
  if (!lastName || lastName.length > 100) {
    fieldErrors.lastName = 'Enter a last name of up to 100 characters.';
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    fieldErrors.email = 'Enter a valid email address.';
  }
  if (password.length < 8 || password.length > 128) {
    fieldErrors.password = 'Use a password between 8 and 128 characters.';
  }
  if (!confirmPassword || confirmPassword !== password) {
    fieldErrors.confirmPassword = 'Passwords must match.';
  }

  // STEP 3: Return normalized values only when every field is valid.
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }
  return {
    success: true,
    value: { firstName, lastName, email, password, confirmPassword },
  };
}
