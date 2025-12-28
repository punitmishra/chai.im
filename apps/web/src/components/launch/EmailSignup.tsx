'use client';

import { useState, useCallback } from 'react';
import { useToastStore } from '@/store/toastStore';

interface EmailSignupProps {
  onSuccess?: () => void;
}

export function EmailSignup({ onSuccess }: EmailSignupProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      addToast('Please enter your email address', 'error');
      return;
    }

    if (!validateEmail(email)) {
      addToast('Please enter a valid email address', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Store in localStorage for now (can be replaced with API call)
      const waitlist = JSON.parse(localStorage.getItem('chai-waitlist') || '[]');

      if (waitlist.includes(email.toLowerCase())) {
        addToast('You\'re already on the waitlist!', 'info');
        setIsSubmitted(true);
        return;
      }

      waitlist.push(email.toLowerCase());
      localStorage.setItem('chai-waitlist', JSON.stringify(waitlist));

      setIsSubmitted(true);
      addToast('You\'re on the list! We\'ll notify you at launch.', 'success');
      onSuccess?.();
    } catch {
      addToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, addToast, onSuccess]);

  if (isSubmitted) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-4">
          <svg
            className="w-6 h-6 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-white font-medium">You&apos;re on the list!</p>
        <p className="text-sm text-zinc-500 mt-1">
          We&apos;ll email you when Chai launches.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={isSubmitting}
          className="
            flex-1 px-4 py-3
            bg-zinc-900/50 border border-zinc-800/50 rounded-2xl
            text-white placeholder-zinc-600
            focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20
            transition-all duration-200
            disabled:opacity-50
          "
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="
            px-5 py-3 rounded-2xl font-medium
            bg-gradient-to-r from-amber-500 to-orange-500
            text-black
            hover:from-amber-400 hover:to-orange-400
            shadow-lg shadow-amber-500/20
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2
          "
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span className="hidden sm:inline">Joining...</span>
            </>
          ) : (
            <>
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="hidden sm:inline">Notify Me</span>
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-zinc-600 text-center">
        We&apos;ll only email you once when we launch. No spam, ever.
      </p>
    </form>
  );
}
