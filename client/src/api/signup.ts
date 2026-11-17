import { apiRequest } from './client';

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

export function signup(values: SignupValues): Promise<SignupResult> {
  return apiRequest<SignupResult>('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
}
