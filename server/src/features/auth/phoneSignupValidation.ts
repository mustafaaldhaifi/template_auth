export type PhoneSignupInput = {
  firstName: string;
  lastName: string;
  countryIso2: string;
  phone: string;
  channel: 'sms' | 'whatsapp';
  password: string;
  phoneCode: string;
  action: 'send_code' | 'confirm_code';
};

type Result = { success: true; value: PhoneSignupInput } |
  { success: false; fieldErrors: Record<string, string> };

/**
 * Validates a phone signup request before any delivery or account write.
 * 1. Read the expected fields and validate common account details.
 * 2. Validate the selected country, phone, channel, and action-specific code.
 */
export function validatePhoneSignupInput(body: unknown): Result {
  // STEP 1: Reject missing or malformed account details.
  const fields = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const firstName = typeof fields.firstName === 'string' ? fields.firstName.trim() : '';
  const lastName = typeof fields.lastName === 'string' ? fields.lastName.trim() : '';
  const password = typeof fields.password === 'string' ? fields.password : '';
  const confirmPassword = typeof fields.confirmPassword === 'string' ? fields.confirmPassword : '';
  const countryIso2 = typeof fields.countryIso2 === 'string' ? fields.countryIso2.toUpperCase() : '';
  const phone = typeof fields.phone === 'string' ? fields.phone.replace(/\D/g, '') : '';
  const channel = fields.channel;
  const action = fields.phoneAction;
  const phoneCode = typeof fields.phoneCode === 'string' ? fields.phoneCode : '';
  const fieldErrors: Record<string, string> = {};
  if (!firstName || firstName.length > 100) fieldErrors.firstName = 'Enter a first name of up to 100 characters.';
  if (!lastName || lastName.length > 100) fieldErrors.lastName = 'Enter a last name of up to 100 characters.';
  if (password.length < 8 || password.length > 128) fieldErrors.password = 'Use a password between 8 and 128 characters.';
  if (!confirmPassword || confirmPassword !== password) fieldErrors.confirmPassword = 'Passwords must match.';

  // STEP 2: The code is required only when finishing the phone signup.
  if (!/^[A-Z]{2}$/.test(countryIso2)) fieldErrors.countryIso2 = 'Choose a supported country.';
  if (!/^[0-9]{4,15}$/.test(phone)) fieldErrors.phone = 'Enter a valid phone number.';
  if (channel !== 'sms' && channel !== 'whatsapp') fieldErrors.channel = 'Choose a delivery channel.';
  if (action !== 'send_code' && action !== 'confirm_code') fieldErrors.phoneAction = 'Choose a valid phone action.';
  if (action === 'confirm_code' && !/^[0-9]{8}$/.test(phoneCode)) {
    fieldErrors.phoneCode = 'Enter the eight-digit code.';
  }
  return Object.keys(fieldErrors).length > 0 ? { success: false, fieldErrors } : {
    success: true,
    value: { firstName, lastName, countryIso2, phone,
      channel: channel as PhoneSignupInput['channel'], password, phoneCode,
      action: action as PhoneSignupInput['action'] },
  };
}
