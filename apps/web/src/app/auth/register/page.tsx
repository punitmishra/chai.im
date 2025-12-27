'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { registerStart, registerComplete } from '@/lib/api/auth';
import { passwordRegister } from '@/lib/api/password-auth';
import { initCrypto, generatePrekeyBundle, createLockedIdentity } from '@/lib/crypto/wasm';
import { API_URL } from '@/lib/config';
import logger from '@/lib/logger';

type Step = 'username' | 'method' | 'security-key' | 'password';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('username');

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length >= 3) {
      setStep('method');
    }
  };

  const handleSecurityKeyRegister = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { options } = await registerStart(username);

      const credential = await navigator.credentials.create({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('No credential returned');
      }

      const crypto = await initCrypto();
      const identityKey = crypto.exportIdentity();

      const { user_id, session_token } = await registerComplete(
        username,
        credential,
        identityKey
      );

      setUser({ id: user_id, username }, session_token);

      try {
        const prekeyBundle = await generatePrekeyBundle();
        await uploadPrekeyBundle(session_token, prekeyBundle);
      } catch (err) {
        logger.warn('Failed to upload prekey bundle', err);
      }

      router.push('/');
    } catch (err) {
      logger.error('Registration error', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { publicIdentity } = await createLockedIdentity(password);

      const { user_id, session_token } = await passwordRegister(
        username,
        password,
        publicIdentity
      );

      setUser({ id: user_id, username }, session_token);

      try {
        const prekeyBundle = await generatePrekeyBundle();
        await uploadPrekeyBundle(session_token, prekeyBundle);
      } catch (err) {
        logger.warn('Failed to upload prekey bundle', err);
      }

      router.push('/');
    } catch (err) {
      logger.error('Registration error', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'username':
        return (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-zinc-400 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
                placeholder="Choose a username"
                required
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={32}
                autoComplete="username"
                autoFocus
              />
              <p className="mt-2 text-xs text-zinc-600">
                3-32 characters, letters, numbers, underscores
              </p>
            </div>

            <button
              type="submit"
              disabled={username.trim().length < 3}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 disabled:shadow-none"
            >
              Continue
            </button>
          </form>
        );

      case 'method':
        return (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400 text-center mb-6">
              Choose how you want to secure your account
            </p>

            {/* Security Key Option */}
            <button
              onClick={() => setStep('security-key')}
              className="w-full p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-left hover:border-amber-500/50 hover:bg-zinc-800/30 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium group-hover:text-amber-400 transition-colors">Security Key</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Hardware key, Touch ID, or Face ID. Most secure option.
                  </p>
                </div>
              </div>
            </button>

            {/* Password Option */}
            <button
              onClick={() => setStep('password')}
              className="w-full p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-left hover:border-amber-500/50 hover:bg-zinc-800/30 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium group-hover:text-amber-400 transition-colors">Password</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Create a strong password. Works on any device.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep('username')}
              className="w-full py-3 px-4 text-zinc-400 hover:text-white hover:bg-zinc-800/30 font-medium rounded-2xl transition-all duration-200"
            >
              Back
            </button>
          </div>
        );

      case 'security-key':
        return (
          <div className="space-y-4">
            <div className="py-8 px-6 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2">Ready to Register</h3>
              <p className="text-sm text-zinc-500">
                Click below to register your security key, Touch ID, or Face ID
              </p>
            </div>

            <button
              onClick={handleSecurityKeyRegister}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 disabled:shadow-none"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Creating account...
                </span>
              ) : (
                'Register Security Key'
              )}
            </button>

            <button
              onClick={() => setStep('method')}
              className="w-full py-3 px-4 text-zinc-400 hover:text-white hover:bg-zinc-800/30 font-medium rounded-2xl transition-all duration-200"
            >
              Back
            </button>
          </div>
        );

      case 'password':
        return (
          <form onSubmit={handlePasswordRegister} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm text-zinc-400 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
                placeholder="Create a strong password"
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-zinc-400 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
                placeholder="Confirm your password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="mt-2 text-xs text-zinc-600">
                Minimum 8 characters. This password protects your encryption keys.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || password.length < 8}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 disabled:shadow-none"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep('method')}
              className="w-full py-3 px-4 text-zinc-400 hover:text-white hover:bg-zinc-800/30 font-medium rounded-2xl transition-all duration-200"
            >
              Back
            </button>
          </form>
        );
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'username': return 'Create account';
      case 'method': return 'Choose security';
      case 'security-key': return 'Security key';
      case 'password': return 'Set password';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'username': return 'Choose your username';
      case 'method': return `Registering as @${username}`;
      case 'security-key': return 'Hardware or biometric authentication';
      case 'password': return 'Create a strong password';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mb-4 shadow-lg shadow-amber-500/20">
            <span className="text-2xl">☕</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">{getStepTitle()}</h1>
          <p className="text-zinc-500 mt-1 text-sm">{getStepSubtitle()}</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step === 'username' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step === 'method' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${['security-key', 'password'].includes(step) ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-zinc-800'}`} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step content */}
        {renderStep()}

        {/* Footer */}
        <p className="text-center text-sm text-zinc-600 mt-8">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

async function uploadPrekeyBundle(token: string, bundle: Uint8Array): Promise<void> {
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
