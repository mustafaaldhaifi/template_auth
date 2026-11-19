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
