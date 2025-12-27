'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { loginStart, loginComplete } from '@/lib/api/auth';
import { passwordLogin } from '@/lib/api/password-auth';
import { initCryptoWithPassword, isIdentityLocked } from '@/lib/crypto/wasm';
import logger from '@/lib/logger';

type AuthMethod = 'choose' | 'security-key' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('choose');

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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Authenticate with server
      const { user_id, session_token } = await passwordLogin(username, password);

      // Try to unlock local encryption keys with password
      // This may fail if user is logging in on a new device
      try {
        const isLocked = await isIdentityLocked();
        if (isLocked) {
          await initCryptoWithPassword(password);
        }
      } catch (cryptoErr) {
        logger.warn('No local keys found or failed to unlock', cryptoErr);
        // Not fatal - crypto will be initialized fresh if needed
      }

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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
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
            {/* Security Key Option */}
            <button
              onClick={handleSecurityKeyLogin}
              disabled={isLoading || !username.trim()}
              className="w-full p-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
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

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800/50"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-zinc-950 text-zinc-600">or</span>
              </div>
            </div>

            {/* Password Option */}
            <button
              onClick={() => setAuthMethod('password')}
              disabled={!username.trim()}
              className="w-full p-4 bg-zinc-900/50 hover:bg-zinc-800/50 disabled:bg-zinc-900/30 disabled:text-zinc-600 text-white font-medium rounded-2xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-zinc-800/50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Sign in with Password
            </button>
          </div>
        )}

        {authMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                autoFocus
              />
              <p className="mt-2 text-xs text-zinc-600">
                The password you created during registration
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password}
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
              onClick={() => setAuthMethod('choose')}
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
