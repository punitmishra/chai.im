'use client';

import { useState, useCallback } from 'react';
import { useToastStore } from '@/store/toastStore';

interface MnemonicDisplayProps {
  words: string;
  onConfirmed?: () => void;
}

/**
 * Display a mnemonic phrase in a secure, readable grid.
 * Requires user confirmation before proceeding.
 */
export function MnemonicDisplay({ words, onConfirmed }: MnemonicDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const wordList = words.split(' ');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(words);
      setCopied(true);
      addToast('Recovery phrase copied to clipboard', 'success');
      // Clear clipboard after 60 seconds for security
      setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
      }, 60000);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      addToast('Failed to copy to clipboard', 'error');
    }
  }, [words, addToast]);

  const handleConfirm = useCallback(() => {
    if (!confirmed) return;
    onConfirmed?.();
  }, [confirmed, onConfirmed]);

  return (
    <div className="space-y-6">
      {/* Word Grid */}
      <div className="bg-dark-900/50 border border-dark-700/50 rounded-2xl p-6">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {wordList.map((word, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-dark-800/50 rounded-xl px-3 py-2"
            >
              <span className="text-slate-600 text-xs font-mono w-5">{i + 1}.</span>
              <span className="text-white font-mono text-sm">{word}</span>
            </div>
          ))}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white border border-dark-700 hover:border-dark-600 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy to clipboard
            </>
          )}
        </button>
      </div>

      {/* Warning */}
      <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-cyan-400 font-medium">Write this down!</p>
            <p className="text-cyan-400/80 text-sm mt-1">
              This is the <strong>only way</strong> to recover your account. Store it in a safe place.
              If you lose this phrase, you will lose access to your account forever.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-5 h-5 border-2 border-dark-600 rounded group-hover:border-dark-600 peer-checked:border-cyan-500 peer-checked:bg-cyan-500 transition-colors">
            {confirmed && (
              <svg className="w-full h-full text-black p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-sm text-slate-400 group-hover:text-slate-300">
          I have written down my recovery phrase and stored it in a safe place
        </span>
      </label>

      {/* Continue Button */}
      <button
        onClick={handleConfirm}
        disabled={!confirmed}
        className={`
          w-full py-3.5 px-4 rounded-2xl font-semibold
          transition-all duration-200
          ${confirmed
            ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-black hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20'
            : 'bg-dark-800 text-slate-500 cursor-not-allowed'}
        `}
      >
        Continue
      </button>
    </div>
  );
}
