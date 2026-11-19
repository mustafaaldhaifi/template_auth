import { apiRequest } from './client';

/** Requests an email code without revealing whether the address has an account. */
export function requestPasswordRecoveryCode(email: string): Promise<void> {
  return apiRequest<void>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
}

/** Exchanges the email code for a one-time password-change grant. */
export function verifyPasswordRecoveryCode(email: string, code: string): Promise<{ token: string }> {
  return apiRequest<{ token: string }>('/api/auth/verify-reset-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
}

/** Spends a verified grant to save the new password. */
export function saveRecoveredPassword(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<void> {
  return apiRequest<void>('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, password, confirmPassword }),
  });
}
