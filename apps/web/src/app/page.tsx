'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  CountdownTimer,
  EncryptionDemo,
  EmailSignup,
  SecurityBadges,
} from '@/components/launch';

// Launch date: February 1, 2025
const LAUNCH_DATE = new Date('2025-02-01T00:00:00Z');

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
  if (!hasHydrated || sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <section className="pt-16 md:pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 mb-6 shadow-2xl shadow-amber-500/30 glow-pulse">
              <span className="text-5xl">☕</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              <span className="text-amber-400">Chai</span>
              <span className="text-zinc-500">.im</span>
            </h1>
            <p className="text-xl text-zinc-400 mt-4 max-w-md mx-auto">
              Secure, end-to-end encrypted messaging.
              <br />
              Your conversations, truly private.
            </p>
          </div>

          {/* Countdown */}
          <div className="mb-12">
            <p className="text-sm text-zinc-500 mb-4 uppercase tracking-wider">
              Launching In
            </p>
            <CountdownTimer targetDate={LAUNCH_DATE} />
          </div>
        </div>
      </section>

      {/* Encryption Demo Section */}
      <section className="py-12 md:py-16 px-4 bg-zinc-900/30 border-y border-zinc-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-white mb-2">
            See Encryption in Action
          </h2>
          <p className="text-zinc-500 text-center mb-8">
            Type a message and watch it get encrypted in real-time
          </p>
          <EncryptionDemo />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-white mb-8">
            Built for Privacy
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Feature
              icon="🔐"
              title="E2E Encrypted"
              description="Signal Protocol encryption"
              delay={0}
            />
            <Feature
              icon="🔑"
              title="Hardware Keys"
              description="FIDO2 WebAuthn support"
              delay={1}
            />
            <Feature
              icon="⚡"
              title="Real-time"
              description="Instant WebSocket messaging"
              delay={2}
            />
            <Feature
              icon="🤖"
              title="Local AI"
              description="Privacy-first AI features"
              delay={3}
            />
          </div>
        </div>
      </section>

      {/* Email Signup Section */}
      <section className="py-12 md:py-16 px-4 bg-gradient-to-b from-transparent to-zinc-900/50">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">
            Get Notified at Launch
          </h2>
          <p className="text-zinc-500 mb-6">
            Be the first to know when Chai goes live
          </p>
          <EmailSignup />
        </div>
      </section>

      {/* Security Badges */}
      <section className="py-10 px-4 border-t border-zinc-800/50">
        <SecurityBadges />
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 px-4">
        <div className="max-w-sm mx-auto space-y-3">
          <Link
            href="/auth/register"
            className="w-full block py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold rounded-2xl transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 text-center hover:scale-[1.02] active:scale-[0.98]"
          >
            Join Early Access
          </Link>
          <Link
            href="/auth/login"
            className="w-full block py-3.5 px-4 bg-zinc-900/50 hover:bg-zinc-800/50 text-white font-medium rounded-2xl transition-all duration-200 border border-zinc-800/50 text-center"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center border-t border-zinc-800/50">
        <p className="text-sm text-zinc-600">
          Open source &middot;{' '}
          <a
            href="https://github.com/punitmishra/chai.im"
            className="text-amber-400 hover:text-amber-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <div
      className="feature-card p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-center hover:border-amber-500/30 hover:bg-zinc-800/30 transition-all duration-300"
      style={{ animationDelay: `${delay * 0.1}s` }}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-medium text-white text-sm">{title}</h3>
      <p className="text-xs text-zinc-500 mt-1">{description}</p>
    </div>
  );
}
