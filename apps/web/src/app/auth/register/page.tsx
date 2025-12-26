'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { registerStart, registerComplete } from '@/lib/api/auth';
import { initCrypto, generatePrekeyBundle } from '@/lib/crypto/wasm';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'username' | 'security-key'>('username');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (step === 'username') {
        // Move to security key step
        setStep('security-key');
        setIsLoading(false);
        return;
      }

      // Step 1: Get registration challenge from server
      const { options } = await registerStart(username);

      // Step 2: Create credential using WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Step 3: Initialize crypto and get identity key
      const crypto = await initCrypto();
      const identityKey = crypto.export_identity();

      // Step 4: Complete registration with server
      const { user_id, session_token } = await registerComplete(
        username,
        credential,
        identityKey
      );

      // Step 5: Store session in state
      setUser({ id: user_id, username }, session_token);

      // Step 6: Generate and upload prekey bundle
      try {
        const prekeyBundle = await generatePrekeyBundle();
        await uploadPrekeyBundle(session_token, prekeyBundle);
      } catch (err) {
        console.warn('Failed to upload prekey bundle, will retry later:', err);
      }

      // Redirect to chat
      router.push('/chat');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
      // Reset to username step if we failed during WebAuthn
      if (step === 'security-key') {
        setStep('username');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Create account</h1>
          <p className="mt-2 text-dark-400">
            {step === 'username'
              ? 'Choose a unique username'
              : 'Register your security key'}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2">
          <div
            className={`h-2 w-16 rounded-full ${
              step === 'username' ? 'bg-primary-500' : 'bg-dark-700'
            }`}
          />
          <div
            className={`h-2 w-16 rounded-full ${
              step === 'security-key' ? 'bg-primary-500' : 'bg-dark-700'
            }`}
          />
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          {step === 'username' && (
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Choose a username"
                required
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={32}
              />
              <p className="mt-2 text-xs text-dark-400">
                3-32 characters, letters, numbers, and underscores only
              </p>
            </div>
          )}

          {step === 'security-key' && (
            <div className="card text-center">
              <div className="text-4xl mb-4">🔑</div>
              <h3 className="font-semibold">Security Key Required</h3>
              <p className="text-sm text-dark-400 mt-2">
                Insert your hardware security key (YubiKey, etc.) or use your
                device's built-in authenticator.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (step === 'username' && !username)}
            className="btn-primary w-full"
          >
            {isLoading
              ? 'Processing...'
              : step === 'username'
              ? 'Continue'
              : 'Register Security Key'}
          </button>

          {step === 'security-key' && (
            <button
              type="button"
              onClick={() => setStep('username')}
              className="btn-ghost w-full"
            >
              Back
            </button>
          )}
        </form>

        <div className="text-center text-sm text-dark-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary-500 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

// Helper to upload prekey bundle
async function uploadPrekeyBundle(token: string, bundle: Uint8Array): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const response = await fetch(`${API_URL}/prekeys/bundle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      bundle: {
        identity_key: Array.from(bundle.slice(0, 32)),
        signed_prekey: Array.from(bundle.slice(32, 64)),
        signed_prekey_signature: Array.from(bundle.slice(64, 128)),
        signed_prekey_id: 1,
        one_time_prekey: null,
        one_time_prekey_id: null,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to upload prekey bundle');
  }
}
