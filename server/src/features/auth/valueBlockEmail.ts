import { getAuthMailConfig, sendAuthEmail } from './authEmail';
import { findBlockNotificationEmail, markValueBlockNotified, type NewValueBlock } from './valueAttemptRepository';

/**
 * Sends one generic warning after a registered account's new block commits.
 * 1. Confirm the block is still current and resolve a registered email.
 * 2. Send the warning without exposing the attempted login value.
 * 3. Record delivery only after SMTP accepts the message; log failures without changing the block.
 */
export async function notifyRegisteredValueBlock(block: NewValueBlock): Promise<void> {
  try {
    // STEP 1: Unknown or replaced blocks have no notification recipient.
    const email = await findBlockNotificationEmail(block);
    if (!email) return;

    // STEP 2: Keep the message generic and reuse the account mail settings.
    await sendAuthEmail(getAuthMailConfig(), {
      to: email,
      subject: 'A temporary sign-in restriction was applied',
      text: 'Repeated unsuccessful sign-in attempts caused a temporary restriction on your account.\n\n' +
        'If this was you, wait and try again. If it was not you, consider changing your password.',
    });

    // STEP 3: A delivery marker must never be set for a failed send or a newer block.
    await markValueBlockNotified(block);
  } catch (error) {
    // NOTE: The block is committed independently of email delivery.
    const deliveryCode = error && typeof error === 'object' && 'code' in error
      ? error.code : 'UNKNOWN';
    console.error('Failed to deliver a sign-in restriction warning.', deliveryCode);
  }
}
