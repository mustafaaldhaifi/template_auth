import { getAuthMailConfig, sendAuthEmail } from './authEmail';

type PhoneVerificationMessage = { phone: string; code: string };

// NOTE: Temporary test destination until SMS and WhatsApp providers are connected.
const testRecipient = 'mustafaaldhaifi@gmail.com';

/** Delivers the SMS channel's code to the configured test inbox until an SMS provider is added. */
export async function sendPhoneCodeBySms({ phone, code }: PhoneVerificationMessage): Promise<void> {
  await sendAuthEmail(getAuthMailConfig(), {
    to: testRecipient,
    subject: '[SMS preview] Phone verification code',
    text: `SMS preview for ${phone}.\n\nYour phone verification code is ${code}.`,
  });
}

/** Delivers the WhatsApp channel's code to the configured test inbox until a WhatsApp provider is added. */
export async function sendPhoneCodeByWhatsApp({ phone, code }: PhoneVerificationMessage): Promise<void> {
  await sendAuthEmail(getAuthMailConfig(), {
    to: testRecipient,
    subject: '[WhatsApp preview] Phone verification code',
    text: `WhatsApp preview for ${phone}.\n\nYour phone verification code is ${code}.`,
  });
}
