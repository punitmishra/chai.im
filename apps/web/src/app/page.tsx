'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-primary-500">Chai</span>
            <span className="text-dark-400">.im</span>
          </h1>
          <p className="text-lg text-dark-400">
            Secure, end-to-end encrypted messaging
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 py-8">
          <Feature
            icon="🔐"
            title="E2E Encrypted"
            description="Signal Protocol"
          />
          <Feature
            icon="🔑"
            title="Hardware Keys"
            description="FIDO2 WebAuthn"
          />
          <Feature
            icon="⚡"
            title="Real-time"
            description="WebSocket"
          />
          <Feature
            icon="🤖"
            title="AI Powered"
            description="Local LLMs"
          />
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Link href="/auth/register" className="btn-primary w-full block">
            Get Started
          </Link>
          <Link href="/auth/login" className="btn-secondary w-full block">
            Sign In
          </Link>
        </div>

        {/* Footer */}
        <p className="text-sm text-dark-500">
          Open source &middot;{' '}
          <a
            href="https://github.com/chai-im/chai.im"
            className="text-primary-500 hover:underline"
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
    <div className="card text-left">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="text-sm text-dark-400">{description}</p>
    </div>
  );
}
