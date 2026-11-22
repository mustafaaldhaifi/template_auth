import { apiRequest } from './client';
import type { VerificationProof } from './verification';

export type SignupValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type SignupResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function signup(values: SignupValues, verification?: VerificationProof): Promise<SignupResult> {
  return apiRequest<SignupResult>('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...values, ...verification }),
  });
}

export type PhoneSignupValues = {
  firstName: string;
  lastName: string;
  countryIso2: string;
  phone: string;
  channel: 'sms' | 'whatsapp';
  password: string;
  confirmPassword: string;
};

/** Requests the same eight-digit code flow used for email, delivered to a test inbox for now. */
export function requestPhoneSignupCode(values: PhoneSignupValues, verification?: VerificationProof): Promise<void> {
  return apiRequest<void>('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ method: 'phone', phoneAction: 'send_code', ...values, ...verification }),
  });
}

/** Creates a phone-only account after its signed challenge and code match. */
export function completePhoneSignup(values: PhoneSignupValues, phoneCode: string,
  verification?: VerificationProof): Promise<{ id: string; firstName: string; lastName: string; phone: string }> {
  return apiRequest('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ method: 'phone', phoneAction: 'confirm_code', ...values, phoneCode, ...verification }),
  });
}
