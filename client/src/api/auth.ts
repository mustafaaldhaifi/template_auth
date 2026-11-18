import { apiRequest } from './client';

export type LoginValues = { email: string; password: string };
export type LoginResult = { id: string; firstName: string; lastName: string; email: string };
export type CurrentUser = { firstName: string; lastName: string; email: string };

/** Sends credentials and lets the platform retain the server's session cookie. */
export function login(values: LoginValues): Promise<LoginResult> {
  return apiRequest<LoginResult>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(values),
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

/** Requests a reset link without exposing whether the email has an account. */
export function requestPasswordReset(email: string): Promise<void> {
  return apiRequest<void>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}
