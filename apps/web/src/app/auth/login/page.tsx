'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { loginStart, loginComplete } from '@/lib/api/auth';
import { requestChallenge, verifySignature } from '@/lib/api/identity-auth';
import {
  initCrypto,
  hasStoredIdentity,
  signChallenge,
  restoreIdentityFromMnemonic,
  validateMnemonic
} from '@/lib/crypto/wasm';
import { MnemonicInput } from '@/components/auth';
import logger from '@/lib/logger';

type AuthMethod = 'choose' | 'security-key' | 'recovery-phrase' | 'auto-sign';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('choose');
  const [hasLocalIdentity, setHasLocalIdentity] = useState(false);
  const [checkingIdentity, setCheckingIdentity] = useState(true);

  // Check for local identity on mount
  useEffect(() => {
    async function checkIdentity() {
      try {
        const hasIdentity = await hasStoredIdentity();
        setHasLocalIdentity(hasIdentity);
      } catch (err) {
        logger.error('Failed to check local identity', err);
      } finally {
        setCheckingIdentity(false);
      }
    }
    checkIdentity();
  }, []);

  const handleSecurityKeyLogin = async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { options } = await loginStart(username);

      const credential = await navigator.credentials.get({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to get credential');
      }

      const { user_id, session_token } = await loginComplete(username, credential);
      setUser({ id: user_id, username }, session_token);
      router.push('/chat');
    } catch (err) {
      logger.error('Login error', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentityLogin = async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Initialize crypto from stored identity
      await initCrypto();

      // Request challenge from server
      const { challenge } = await requestChallenge(username);

      // Sign challenge with identity key
      const signature = await signChallenge(challenge);

      // Verify signature with server
      const { user_id, session_token } = await verifySignature(username, challenge, signature);

      setUser({ id: user_id, username }, session_token);
      router.push('/chat');
    } catch (err) {
      logger.error('Login error', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryPhraseLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    const words = recoveryPhrase.trim().split(/\s+/);
    if (words.length !== 24 && words.length !== 12) {
      setError('Recovery phrase must be 12 or 24 words');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Validate mnemonic format
      const isValid = await validateMnemonic(recoveryPhrase.trim());
      if (!isValid) {
        throw new Error('Invalid recovery phrase');
      }

      // Restore identity from mnemonic (saves to IndexedDB)
      await restoreIdentityFromMnemonic(recoveryPhrase.trim());

      // Request challenge from server
      const { challenge } = await requestChallenge(username);

      // Sign challenge with restored identity
      const signature = await signChallenge(challenge);

      // Verify signature with server
      const { user_id, session_token } = await verifySignature(username, challenge, signature);

      setUser({ id: user_id, username }, session_token);
      router.push('/chat');
    } catch (err) {
      logger.error('Login error', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mb-4 shadow-lg shadow-amber-500/20">
            <span className="text-2xl">☕</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="text-zinc-500 mt-1 text-sm">Sign in to continue to Chai</p>
        </div>

        {/* Username input (always shown) */}
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm text-zinc-400 mb-1.5">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
            placeholder="Enter your username"
            autoComplete="username"
            autoFocus
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Auth method selection or form */}
        {authMethod === 'choose' && (
          <div className="space-y-3">
            {/* Show auto-sign option if local identity exists */}
            {!checkingIdentity && hasLocalIdentity && (
              <>
                <button
                  onClick={handleIdentityLogin}
                  disabled={isLoading || !username.trim()}
                  className="w-full p-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      Sign in with Device Key
                    </>
                  )}
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800/50"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-zinc-950 text-zinc-600">or use another method</span>
                  </div>
                </div>
              </>
            )}

            {/* Security Key Option */}
            <button
              onClick={handleSecurityKeyLogin}
              disabled={isLoading || !username.trim()}
              className={`w-full p-4 ${!hasLocalIdentity ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 disabled:shadow-none' : 'bg-zinc-900/50 hover:bg-zinc-800/50 disabled:bg-zinc-900/30 disabled:text-zinc-600 text-white font-medium border border-zinc-800/50'} rounded-2xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <div className={`h-4 w-4 animate-spin rounded-full border-2 ${!hasLocalIdentity ? 'border-black/30 border-t-black' : 'border-white/30 border-t-white'}`} />
                  Authenticating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  Sign in with Security Key
                </>
              )}
            </button>

            {/* Recovery Phrase Option */}
            <button
              onClick={() => setAuthMethod('recovery-phrase')}
              disabled={!username.trim()}
              className="w-full p-4 bg-zinc-900/50 hover:bg-zinc-800/50 disabled:bg-zinc-900/30 disabled:text-zinc-600 text-white font-medium rounded-2xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-zinc-800/50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
              Sign in with Recovery Phrase
            </button>
          </div>
        )}

        {authMethod === 'recovery-phrase' && (
          <form onSubmit={handleRecoveryPhraseLogin} className="space-y-4">
            <MnemonicInput
              value={recoveryPhrase}
              onChange={setRecoveryPhrase}
              wordCount={24}
              error={undefined}
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || recoveryPhrase.trim().split(/\s+/).filter(Boolean).length < 12}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 disabled:shadow-none"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod('choose');
                setRecoveryPhrase('');
              }}
              className="w-full py-3 px-4 text-zinc-400 hover:text-white hover:bg-zinc-800/30 font-medium rounded-2xl transition-all duration-200"
            >
              Back
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-zinc-600 mt-8">
          Don't have an account?{' '}
          <Link href="/auth/register" className="text-amber-400 hover:text-amber-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
