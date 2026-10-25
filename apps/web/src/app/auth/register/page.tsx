'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { registerStart, registerComplete } from '@/lib/api/auth';
import { identityRegister } from '@/lib/api/identity-auth';
import { initCrypto, generatePrekeyBundle, generateMnemonic, createIdentityFromMnemonic } from '@/lib/crypto/wasm';
import { MnemonicDisplay } from '@/components/auth';
import { ChaiLogo } from '@/components/ChaiLogo';
import { Button, Input } from '@/components/ui';
import { API_URL } from '@/lib/config';
import logger from '@/lib/logger';

type Step = 'username' | 'method' | 'security-key' | 'mnemonic-generate' | 'mnemonic-confirm';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('username');
  // Word positions (0-based) the user must re-enter to prove they saved the phrase.
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmInputs, setConfirmInputs] = useState<string[]>([]);
  const [confirmError, setConfirmError] = useState('');

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
      // Send the PUBLIC identity key to the server. exportIdentity() returns the
      // 32-byte private seed (used locally for signing) and must never leave the device.
      const identityKey = crypto.publicIdentity();

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

      router.push('/chat');
    } catch (err) {
      logger.error('Registration error', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMnemonic = async () => {
    setIsLoading(true);
    setError('');

    try {
      const words = await generateMnemonic(24);
      setMnemonic(words);
      setStep('mnemonic-generate');
    } catch (err) {
      logger.error('Mnemonic generation error', err);
      setError(err instanceof Error ? err.message : 'Failed to generate recovery phrase');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMnemonicConfirmed = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Create identity from mnemonic and save to IndexedDB
      const { publicIdentity } = await createIdentityFromMnemonic(mnemonic);

      // Register with server using identity key
      const { user_id, session_token } = await identityRegister(username, publicIdentity);

      setUser({ id: user_id, username }, session_token);

      // Upload prekey bundle
      try {
        const prekeyBundle = await generatePrekeyBundle();
        await uploadPrekeyBundle(session_token, prekeyBundle);
      } catch (err) {
        logger.warn('Failed to upload prekey bundle', err);
      }

      router.push('/chat');
    } catch (err) {
      logger.error('Registration error', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // After the user acknowledges they saved the phrase, pick two distinct words
  // to verify before finishing registration.
  const handleProceedToConfirm = () => {
    const total = mnemonic.trim().split(/\s+/).filter(Boolean).length;
    const indices = new Set<number>();
    while (indices.size < 2 && indices.size < total) {
      indices.add(Math.floor(Math.random() * total));
    }
    const picked = Array.from(indices).sort((a, b) => a - b);
    setConfirmIndices(picked);
    setConfirmInputs(picked.map(() => ''));
    setConfirmError('');
    setStep('mnemonic-confirm');
  };

  const handleVerifyMnemonic = (e: React.FormEvent) => {
    e.preventDefault();
    const wordList = mnemonic.trim().split(/\s+/);
    const allMatch = confirmIndices.every(
      (wordIndex, i) => confirmInputs[i]?.trim().toLowerCase() === wordList[wordIndex]
    );
    if (!allMatch) {
      setConfirmError('Those words do not match your recovery phrase. Please check and try again.');
      return;
    }
    setConfirmError('');
    handleMnemonicConfirmed();
  };

  const renderStep = () => {
    switch (step) {
      case 'username':
        return (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <Input
              id="username"
              type="text"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              hint="3-32 characters, letters, numbers, underscores"
              required
              pattern="[a-zA-Z0-9_]+"
              minLength={3}
              maxLength={32}
              autoComplete="username"
              autoFocus
            />

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={username.trim().length < 3}>
              Continue
            </Button>
          </form>
        );

      case 'method':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 text-center mb-6">
              Choose how you want to secure your account
            </p>

            {/* Security Key Option */}
            <button
              onClick={() => setStep('security-key')}
              className="w-full p-5 bg-dark-900/50 border border-dark-700/50 rounded-2xl text-left hover:border-cyan-500/50 hover:bg-dark-800/30 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium group-hover:text-cyan-400 transition-colors">Security Key</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Hardware key, Touch ID, or Face ID. Most secure option.
                  </p>
                </div>
              </div>
            </button>

            {/* Recovery Phrase Option */}
            <button
              onClick={handleGenerateMnemonic}
              disabled={isLoading}
              className="w-full p-5 bg-dark-900/50 border border-dark-700/50 rounded-2xl text-left hover:border-cyan-500/50 hover:bg-dark-800/30 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-dark-800/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                    {isLoading ? 'Generating...' : 'Recovery Phrase'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    24-word backup phrase. Works on any device.
                  </p>
                </div>
              </div>
            </button>

            <Button variant="ghost" size="lg" fullWidth onClick={() => setStep('username')}>
              Back
            </Button>
          </div>
        );

      case 'security-key':
        return (
          <div className="space-y-4">
            <div className="py-8 px-6 bg-dark-900/50 border border-dark-700/50 rounded-2xl text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-teal-500/20 mb-4">
                <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2">Ready to Register</h3>
              <p className="text-sm text-slate-500">
                Click below to register your security key, Touch ID, or Face ID
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
              onClick={handleSecurityKeyRegister}
            >
              {isLoading ? 'Creating account...' : 'Register Security Key'}
            </Button>

            <Button variant="ghost" size="lg" fullWidth onClick={() => setStep('method')}>
              Back
            </Button>
          </div>
        );

      case 'mnemonic-generate':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-dark-900/50 border border-dark-700/50 rounded-2xl">
              <h3 className="text-white font-medium mb-2">Your Recovery Phrase</h3>
              <p className="text-sm text-slate-500">
                This is your secret backup. Write it down and store it safely.
              </p>
            </div>

            <MnemonicDisplay
              words={mnemonic}
              onConfirmed={handleProceedToConfirm}
            />

            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => {
                setMnemonic('');
                setStep('method');
              }}
            >
              Back
            </Button>
          </div>
        );

      case 'mnemonic-confirm':
        return (
          <form onSubmit={handleVerifyMnemonic} className="space-y-4">
            <div className="p-4 bg-dark-900/50 border border-dark-700/50 rounded-2xl">
              <h3 className="text-white font-medium mb-2">Confirm your recovery phrase</h3>
              <p className="text-sm text-slate-500">
                Enter the following words from the phrase you just saved.
              </p>
            </div>

            {confirmIndices.map((wordIndex, i) => (
              <Input
                key={wordIndex}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={i === 0}
                label={`Word #${wordIndex + 1}`}
                value={confirmInputs[i] ?? ''}
                onChange={(e) => {
                  const next = [...confirmInputs];
                  next[i] = e.target.value.toLowerCase();
                  setConfirmInputs(next);
                  if (confirmError) setConfirmError('');
                }}
                placeholder={`Enter word #${wordIndex + 1}`}
                error={i === confirmIndices.length - 1 && confirmError ? confirmError : undefined}
              />
            ))}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading || confirmInputs.some((w) => !w.trim())}
            >
              {isLoading ? 'Creating account...' : 'Confirm & Finish'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              disabled={isLoading}
              onClick={() => {
                setConfirmError('');
                setStep('mnemonic-generate');
              }}
            >
              Back
            </Button>
          </form>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'username': return 'Create account';
      case 'method': return 'Choose security';
      case 'security-key': return 'Security key';
      case 'mnemonic-generate': return 'Save your phrase';
      case 'mnemonic-confirm': return 'Confirm phrase';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'username': return 'Choose your username';
      case 'method': return `Registering as @${username}`;
      case 'security-key': return 'Hardware or biometric authentication';
      case 'mnemonic-generate': return 'Write down these 24 words';
      case 'mnemonic-confirm': return 'Verify you saved them correctly';
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
          <h1 className="text-2xl font-semibold text-white">{getStepTitle()}</h1>
          <p className="text-slate-500 mt-1 text-sm">{getStepSubtitle()}</p>
        </div>

        {/* Progress with labels (cumulative: completed steps stay filled) */}
        <div className="mb-6">
          {(() => {
            // Map each step to its phase index so the bar fills cumulatively.
            const phase: Record<Step, number> = {
              'username': 0,
              'method': 1,
              'security-key': 2,
              'mnemonic-generate': 2,
              'mnemonic-confirm': 2,
            };
            const current = phase[step];
            const labels = ['Username', 'Security', 'Complete'];
            return (
              <div aria-hidden="true">
                <div className="flex gap-2 mb-2">
                  {labels.map((label, i) => (
                    <div
                      key={label}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= current ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-dark-800'}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  {labels.map((label, i) => (
                    <span key={label} className={i <= current ? 'text-cyan-400' : ''}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
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

        {/* Step content */}
        {renderStep()}

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-8">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
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
