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
import { ChaiLogo } from '@/components/ChaiLogo';
import { Button, Input } from '@/components/ui';
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
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-dark-900 border border-cyan-500/20 mb-4 shadow-lg shadow-cyan-500/20">
            <ChaiLogo size={32} className="text-cyan-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="text-slate-500 mt-1 text-sm">Sign in to continue to Chai</p>
        </div>

        {/* Username input (always shown) */}
        <div className="mb-4">
          <Input
            id="username"
            type="text"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            autoFocus
          />
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm"
          >
            {error}
          </div>
        )}

        {/* Auth method selection or form */}
        {authMethod === 'choose' && (
          <div className="space-y-3">
            {/* Show auto-sign option if local identity exists */}
            {!checkingIdentity && hasLocalIdentity && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading || !username.trim()}
                  onClick={handleIdentityLogin}
                >
                  {isLoading ? (
                    'Signing in...'
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      Sign in with Device Key
                    </>
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-700/50"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-dark-950 text-slate-600">or use another method</span>
                  </div>
                </div>
              </>
            )}

            {/* Security Key Option */}
            <Button
              variant={!hasLocalIdentity ? 'primary' : 'secondary'}
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading || !username.trim()}
              onClick={handleSecurityKeyLogin}
            >
              {isLoading ? (
                'Authenticating...'
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  Sign in with Security Key
                </>
              )}
            </Button>

            {/* Recovery Phrase Option */}
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              disabled={!username.trim()}
              onClick={() => setAuthMethod('recovery-phrase')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
              Sign in with Recovery Phrase
            </Button>
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading || recoveryPhrase.trim().split(/\s+/).filter(Boolean).length < 12}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => {
                setAuthMethod('choose');
                setRecoveryPhrase('');
              }}
            >
              Back
            </Button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-8">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-cyan-400 hover:text-cyan-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
