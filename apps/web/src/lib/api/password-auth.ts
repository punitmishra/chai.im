/**
 * Password-based authentication API client.
 */

import { API_URL } from '@/lib/config';

export interface PasswordRegisterResponse {
  user_id: string;
  session_token: string;
}

export interface PasswordLoginResponse {
  user_id: string;
  session_token: string;
}

/**
 * Register with username and password.
 */
export async function passwordRegister(
  username: string,
  password: string,
  identityKey: Uint8Array
): Promise<PasswordRegisterResponse> {
  const response = await fetch(`${API_URL}/auth/password/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      identity_key: Array.from(identityKey),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}

/**
 * Login with username and password.
 */
export async function passwordLogin(
  username: string,
  password: string
): Promise<PasswordLoginResponse> {
  const response = await fetch(`${API_URL}/auth/password/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}
