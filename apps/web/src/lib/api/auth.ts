/**
 * Authentication API client for WebAuthn registration and login.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface RegisterStartResponse {
  options: PublicKeyCredentialCreationOptions;
  user_id: string;
}

export interface RegisterCompleteResponse {
  user_id: string;
  session_token: string;
}

export interface LoginStartResponse {
  options: PublicKeyCredentialRequestOptions;
}

export interface LoginCompleteResponse {
  user_id: string;
  session_token: string;
}

/**
 * Start registration - get WebAuthn challenge from server.
 */
export async function registerStart(username: string): Promise<RegisterStartResponse> {
  const response = await fetch(`${API_URL}/auth/register/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  const data = await response.json();

  // Convert base64url encoded values to ArrayBuffer for WebAuthn API
  return {
    options: decodeCreationOptions(data.options),
    user_id: data.user_id,
  };
}

/**
 * Complete registration - verify attestation with server.
 */
export async function registerComplete(
  username: string,
  credential: PublicKeyCredential,
  identityKey: Uint8Array
): Promise<RegisterCompleteResponse> {
  const response = await fetch(`${API_URL}/auth/register/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      credential: encodeCredential(credential),
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
 * Start login - get WebAuthn challenge from server.
 */
export async function loginStart(username: string): Promise<LoginStartResponse> {
  const response = await fetch(`${API_URL}/auth/login/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();

  return {
    options: decodeRequestOptions(data.options),
  };
}

/**
 * Complete login - verify assertion with server.
 */
export async function loginComplete(
  username: string,
  credential: PublicKeyCredential
): Promise<LoginCompleteResponse> {
  const response = await fetch(`${API_URL}/auth/login/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      credential: encodeAssertion(credential),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

// Helper functions to convert between WebAuthn API and JSON

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    })),
  };
}

function decodeRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((cred: any) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    })),
  };
}

function encodeCredential(credential: PublicKeyCredential): any {
  const attestation = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(attestation.clientDataJSON),
      attestationObject: bufferToBase64url(attestation.attestationObject),
    },
  };
}

function encodeAssertion(credential: PublicKeyCredential): any {
  const assertion = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(assertion.clientDataJSON),
      authenticatorData: bufferToBase64url(assertion.authenticatorData),
      signature: bufferToBase64url(assertion.signature),
      userHandle: assertion.userHandle ? bufferToBase64url(assertion.userHandle) : null,
    },
  };
}
