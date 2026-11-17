import { hashPassword } from '@/features/auth/passwordHash';
import { createSignupAccount } from '@/features/auth/signupRepository';
import { validateSignupInput } from '@/features/auth/signupValidation';

// NOTE: Sign-up is public and does not use cookies; Expo web may run on another origin.
const signupCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: signupCorsHeaders });
}

/**
 * Validates a sign-up request and creates its account records.
 * 1. Parse and validate the JSON body, returning field errors when needed.
 * 2. Hash the password and create all account rows in one transaction.
 * 3. Return account data or a stable duplicate-email/server error response.
 */
export async function POST(request: Request): Promise<Response> {
  // STEP 1: Reject malformed JSON and invalid fields before accessing the database.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Send a valid JSON request body.' } },
      { status: 400, headers: signupCorsHeaders },
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
      { status: 400, headers: signupCorsHeaders },
    );
  }

  // STEP 2: Derive the credential and write its related rows together.
  const { firstName, lastName, email, password } = validation.value;
  try {
    const passwordHash = await hashPassword(password);
    const id = await createSignupAccount({ firstName, lastName, email, passwordHash });
    return Response.json(
      { data: { id, firstName, lastName, email } },
      { status: 201, headers: signupCorsHeaders },
    );
  } catch (error) {
    // STEP 3: Translate the email constraint without exposing database details.
    if (error && typeof error === 'object' && 'code' in error &&
      'constraint' in error && error.code === '23505' &&
      error.constraint === 'user_emails_email_key') {
      return Response.json(
        {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists.',
            fieldErrors: { email: 'This email address is already registered.' },
          },
        },
        { status: 409, headers: signupCorsHeaders },
      );
    }
    console.error('Failed to create a sign-up account.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not create your account right now.' } },
      { status: 500, headers: signupCorsHeaders },
    );
  }
}
