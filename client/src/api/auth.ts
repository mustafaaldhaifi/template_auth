import { apiRequest } from './client';
import type { VerificationProof } from './verification';

export type LoginValues = { email: string; password: string };
export type PhoneLoginValues = { method: 'phone'; countryIso2: string; phone: string; password: string };
export type LoginResult = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null };
export type CurrentUser = { firstName: string; lastName: string; email: string | null; phone: string | null };

/** Sends credentials and lets the platform retain the server's session cookie. */
export function login(values: LoginValues | PhoneLoginValues, verification?: VerificationProof): Promise<LoginResult> {
  return apiRequest<LoginResult>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...values, ...verification }),
  });
}

/** Invalidates the current server session and clears its cookie. */
export function logout(): Promise<void> {
  return apiRequest<void>('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

/** Loads the account associated with the platform's current session cookie. */
export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/api/auth/me', {
    method: 'GET',
    credentials: 'include',
  });
}
