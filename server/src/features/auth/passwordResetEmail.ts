import { sendAuthEmail, type AuthMailConfig } from './authEmail';
import { passwordResetLifetimeMinutes } from './passwordResetToken';

/**
 * Sends a numeric recovery code to the account's stored email address.
 * 1. Build a message without a bearer URL or grant token.
 * 2. Deliver it using the shared account mail transport.
 */
export async function sendPasswordResetCodeEmail(
  config: AuthMailConfig,
  email: string,
  code: string,
): Promise<void> {
  // STEP 1: The email contains only the short-lived code.
  const message = {
    to: email,
    subject: 'Your password recovery code',
    text: `Your password recovery code is ${code}.\n\n` +
      `It expires in ${passwordResetLifetimeMinutes} minutes. If you did not request this, ignore this message.`,
  };
  // STEP 2: Reuse the existing SMTP settings and TLS behavior.
  await sendAuthEmail(config, message);
}
