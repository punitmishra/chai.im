'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  // Redirect to chat if already authenticated
  useEffect(() => {
    if (hasHydrated && sessionToken) {
      router.replace('/chat');
    }
  }, [hasHydrated, sessionToken, router]);

  // Show loading while checking auth
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
        </div>
      </div>
    );
  }

  // If authenticated, show loading while redirecting
  if (sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 mb-6 shadow-xl shadow-amber-500/30">
            <span className="text-4xl">☕</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-amber-400">Chai</span>
            <span className="text-zinc-500">.im</span>
          </h1>
          <p className="text-zinc-500 mt-2">
            Secure, end-to-end encrypted messaging
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Feature icon="🔐" title="E2E Encrypted" description="Signal Protocol" />
          <Feature icon="🔑" title="Hardware Keys" description="FIDO2 WebAuthn" />
          <Feature icon="⚡" title="Real-time" description="WebSocket" />
          <Feature icon="🤖" title="AI Powered" description="Local LLMs" />
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/auth/register"
            className="w-full block py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold rounded-2xl transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="w-full block py-3.5 px-4 bg-zinc-900/50 hover:bg-zinc-800/50 text-white font-medium rounded-2xl transition-all duration-200 border border-zinc-800/50"
          >
            Sign In
          </Link>
        </div>

        {/* Footer */}
        <p className="text-sm text-zinc-600 mt-8">
          Open source &middot;{' '}
          <a
            href="https://github.com/chai-im/chai.im"
            className="text-amber-400 hover:text-amber-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-left hover:border-zinc-700/50 transition-all duration-200">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-medium text-white text-sm">{title}</h3>
      <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
    </div>
  );
}
