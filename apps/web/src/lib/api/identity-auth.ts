/**
 * Identity key challenge-response authentication API client.
 */

import { API_URL } from '@/lib/config';

export interface IdentityRegisterResponse {
  user_id: string;
  session_token: string;
}

export interface ChallengeResponse {
  challenge: number[]; // Uint8Array as JSON
  expires_at: number;
}

export interface VerifyResponse {
  user_id: string;
  session_token: string;
}

/**
 * Register with identity key.
 */
export async function identityRegister(
  username: string,
  identityKey: Uint8Array
): Promise<IdentityRegisterResponse> {
  const response = await fetch(`${API_URL}/auth/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      identity_key: Array.from(identityKey),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}

/**
 * Request a login challenge.
 */
export async function requestChallenge(
  username: string
): Promise<{ challenge: Uint8Array; expiresAt: number }> {
  const response = await fetch(`${API_URL}/auth/identity/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Challenge request failed' }));
    throw new Error(error.error || 'Challenge request failed');
  }

  const data: ChallengeResponse = await response.json();
  return {
    challenge: new Uint8Array(data.challenge),
    expiresAt: data.expires_at,
  };
}

/**
 * Verify signature and get session.
 */
export async function verifySignature(
  username: string,
  challenge: Uint8Array,
  signature: Uint8Array
): Promise<VerifyResponse> {
  const response = await fetch(`${API_URL}/auth/identity/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      challenge: Array.from(challenge),
      signature: Array.from(signature),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(error.error || 'Verification failed');
  }

  return response.json();
}
