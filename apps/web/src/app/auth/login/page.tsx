'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { loginStart, loginComplete } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Step 1: Get login challenge from server
      const { options } = await loginStart(username);

      // Step 2: Get assertion using WebAuthn API
      const credential = await navigator.credentials.get({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to get credential');
      }

      // Step 3: Complete login with server
      const { user_id, session_token } = await loginComplete(username, credential);

      // Step 4: Store session in state
      setUser({ id: user_id, username }, session_token);

      // Redirect to chat
      router.push('/chat');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-dark-400">
            Sign in with your security key
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
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
              placeholder="Enter your username"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !username}
            className="btn-primary w-full"
          >
            {isLoading ? 'Authenticating...' : 'Sign in with Security Key'}
          </button>
        </form>

        <div className="text-center text-sm text-dark-400">
          Don't have an account?{' '}
          <Link href="/auth/register" className="text-primary-500 hover:underline">
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}
