'use client';

import { useMemo } from 'react';

interface MnemonicInputProps {
  value: string;
  onChange: (value: string) => void;
  wordCount?: 12 | 24;
  error?: string;
  disabled?: boolean;
}

/**
 * Input component for entering a recovery phrase.
 */
export function MnemonicInput({
  value,
  onChange,
  wordCount = 24,
  error,
  disabled = false,
}: MnemonicInputProps) {
  const words = useMemo(() => {
    return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }, [value]);

  const isComplete = words.length === wordCount;
  const progress = Math.min(words.length / wordCount, 1);

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        placeholder={`Enter your ${wordCount}-word recovery phrase...`}
        disabled={disabled}
        className={`
          w-full h-32 px-4 py-3
          bg-zinc-900/50 border rounded-2xl
          text-white placeholder-zinc-600 font-mono text-sm
          focus:outline-none focus:ring-2 focus:ring-amber-500/20
          transition-all duration-200 resize-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-800/50 focus:border-amber-500/50'}
        `}
      />

      {/* Progress Bar */}
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isComplete ? 'bg-green-500' : 'bg-amber-500'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Status */}
      <div className="flex justify-between text-sm">
        <span className={isComplete ? 'text-green-400' : 'text-zinc-500'}>
          {words.length} / {wordCount} words
        </span>
        {error && <span className="text-red-400">{error}</span>}
        {!error && isComplete && (
          <span className="text-green-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ready
          </span>
        )}
      </div>

      {/* Hint */}
      <p className="text-xs text-zinc-600">
        Separate words with spaces. The phrase is case-insensitive.
      </p>
    </div>
  );
}
