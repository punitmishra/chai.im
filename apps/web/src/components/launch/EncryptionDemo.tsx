'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { demoEncrypt, scrambleText, randomString } from '@/lib/encryption-demo';

type DemoStage = 'input' | 'encrypting' | 'encrypted';

export function EncryptionDemo() {
  const [inputText, setInputText] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [ciphertext, setCiphertext] = useState('');
  const [stage, setStage] = useState<DemoStage>('input');
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);

  const handleEncrypt = useCallback(async () => {
    if (!inputText.trim() || stage === 'encrypting') return;

    setStage('encrypting');
    setProgress(0);

    // Get the actual encrypted result
    const encrypted = await demoEncrypt(inputText);
    setCiphertext(encrypted);

    // Animate the scrambling effect
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / duration, 1);
      setProgress(newProgress);

      // Create scrambled display text
      const scrambled = scrambleText(inputText, encrypted, newProgress);
      setDisplayText(scrambled);

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setStage('encrypted');
        setDisplayText(encrypted);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [inputText, stage]);

  const handleReset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setStage('input');
    setDisplayText('');
    setCiphertext('');
    setProgress(0);
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Input/Output Display */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Plaintext Side */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              />
            </svg>
            <span>Your Message</span>
          </div>
          <div
            className={`
              relative min-h-[120px] p-4
              bg-dark-900/50 border border-dark-700/50 rounded-2xl
              transition-all duration-300
              ${stage !== 'input' ? 'opacity-50' : ''}
            `}
          >
            {stage === 'input' ? (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a secret message..."
                className="w-full h-full min-h-[100px] bg-transparent text-white placeholder-slate-600 resize-none focus:outline-none"
                maxLength={100}
              />
            ) : (
              <p className="text-white font-mono text-sm break-all">
                {inputText}
              </p>
            )}
          </div>
        </div>

        {/* Ciphertext Side */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <svg
              className="w-4 h-4 text-cyan-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Encrypted (AES-256-GCM)</span>
          </div>
          <div
            className={`
              relative min-h-[120px] p-4
              bg-dark-900/50 border rounded-2xl
              transition-all duration-300
              ${stage === 'encrypted'
                ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                : 'border-dark-700/50'}
            `}
          >
            {stage === 'input' ? (
              <p className="text-slate-600 text-sm">
                Encrypted output will appear here...
              </p>
            ) : (
              <p
                className={`
                  font-mono text-sm break-all
                  ${stage === 'encrypted'
                    ? 'text-cyan-400'
                    : 'text-slate-400'}
                `}
              >
                {displayText || randomString(inputText.length * 2)}
              </p>
            )}

            {/* Progress indicator */}
            {stage === 'encrypting' && (
              <div className="absolute bottom-2 left-4 right-4">
                <div className="h-1 bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-100"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3">
        {stage === 'input' ? (
          <button
            onClick={handleEncrypt}
            disabled={!inputText.trim()}
            className={`
              px-6 py-3 rounded-2xl font-medium
              transition-all duration-200
              ${inputText.trim()
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-black hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20'
                : 'bg-dark-800 text-slate-500 cursor-not-allowed'}
            `}
          >
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Encrypt Message
            </span>
          </button>
        ) : stage === 'encrypting' ? (
          <div className="px-6 py-3 text-cyan-400 font-medium flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            Encrypting...
          </div>
        ) : (
          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-2xl font-medium bg-dark-800 text-white hover:bg-dark-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again
            </span>
          </button>
        )}
      </div>

      {/* Explanation */}
      <div className="text-center text-sm text-slate-500">
        <p>
          Messages are encrypted with{' '}
          <span className="text-cyan-400">AES-256-GCM</span> before leaving your device.
          <br />
          Only the recipient can decrypt them.
        </p>
      </div>
    </div>
  );
}
