import { authCorsHeaders } from './authCors';
import { appendAuthCookie } from './authCookies';
import { DeviceIssueLimitError } from './deviceRepository';
import { resolveOrCreateDevice, withDeviceCookie, type DeviceIdentity } from './deviceStore';
import { sendPhoneCodeBySms, sendPhoneCodeByWhatsApp } from './phoneVerificationDelivery';
import { clearedPhoneSignupChallenge, createPhoneSignupChallenge, verifyPhoneSignupChallenge } from './phoneSignupChallenge';
import { validatePhoneSignupInput } from './phoneSignupValidation';
import { hashPassword } from './passwordHash';
import { verifyAuthRequest } from './requestVerification';
import { createPhoneSignupAccount, findSignupCountry } from './signupRepository';
import { markRequestVerificationPassed } from '@/features/apiRequests/apiRequestHistory';
import { enforceApiRestriction } from '@/features/apiRequests/enforceApiRestriction';

/** Builds field-aware phone signup errors without exposing stored account details. */
function phoneError(status: number, code: string, message: string,
  headers: Record<string, string>, fieldErrors?: Record<string, string>): Response {
  return Response.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, { status, headers });
}

/**
 * Handles both phone-code stages on the existing signup endpoint.
 * 1. Validate input and verify the web proof before device or account access.
 * 2. Resolve the server's country and enforce route restrictions.
 * 3. Email a channel-labelled code or verify the signed challenge and create the account.
 */
export async function handlePhoneSignup(request: Request, body: unknown): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };
  // STEP 1: Never send a code or issue a device for unverified input.
  const validation = validatePhoneSignupInput(body);
  if (!validation.success) {
    return phoneError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', headers, validation.fieldErrors);
  }
  const verification = await verifyAuthRequest(body, 'signup');
  if (!verification.success) return Response.json({ error: verification.error }, { status: verification.status, headers });
  markRequestVerificationPassed();

  // STEP 2: Route limits and the country catalog are server-controlled.
  const restriction = await enforceApiRestriction(request, headers);
  if (restriction) return restriction;
  let device: DeviceIdentity | null = null;
  try {
    const country = await findSignupCountry(validation.value.countryIso2);
    if (!country) return phoneError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', headers,
      { countryIso2: 'Choose a supported country.' });
    const phone = `${country.dialCode}${validation.value.phone}`;
    if (!/^\+[1-9][0-9]{1,14}$/.test(phone)) {
      return phoneError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', headers,
        { phone: 'Enter a valid international phone number.' });
    }
    device = await resolveOrCreateDevice(request);

    // STEP 3: A test email stands in for the selected delivery provider.
    if (validation.value.action === 'send_code') {
      const challenge = createPhoneSignupChallenge(request, phone, country.id, validation.value.channel, device.id);
      const message = { phone, code: challenge.code };
      if (validation.value.channel === 'sms') await sendPhoneCodeBySms(message);
      else await sendPhoneCodeByWhatsApp(message);
      const response = new Response(null, { status: 204, headers });
      appendAuthCookie(response, challenge.cookie);
      return withDeviceCookie(response, device);
    }

    const confirmed = verifyPhoneSignupChallenge(request, phone, device.id, validation.value.phoneCode);
    if (!confirmed || confirmed.countryId !== country.id || confirmed.channel !== validation.value.channel) {
      return withDeviceCookie(phoneError(400, 'INVALID_PHONE_CODE', 'The code is invalid or expired.', headers,
        { phoneCode: 'Enter the current code sent to your test inbox.' }), device);
    }
    const passwordHash = await hashPassword(validation.value.password);
    const id = await createPhoneSignupAccount({ firstName: validation.value.firstName,
      lastName: validation.value.lastName, passwordHash, phone, countryId: country.id });
    const response = Response.json({ data: { id, firstName: validation.value.firstName,
      lastName: validation.value.lastName, phone } }, { status: 201, headers });
    appendAuthCookie(response, clearedPhoneSignupChallenge(request));
    return withDeviceCookie(response, device);
  } catch (error) {
    if (error instanceof DeviceIssueLimitError) {
      return phoneError(429, 'TOO_MANY_REQUESTS', 'Please wait before trying again.', headers);
    }
    if (error && typeof error === 'object' && 'code' in error &&
      'constraint' in error && error.code === '23505' && error.constraint === 'user_phones_phone_e164_key') {
      return withDeviceCookie(phoneError(409, 'PHONE_ALREADY_EXISTS', 'This phone number is already registered.', headers,
        { phone: 'This phone number is already registered.' }), device);
    }
    console.error('Failed to create a phone signup.', error);
    return withDeviceCookie(phoneError(503, 'PHONE_SIGNUP_UNAVAILABLE', 'Please try again shortly.', headers), device);
  }
}
