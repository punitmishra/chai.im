'use client';

import { useEffect, useState } from 'react';

interface TimeUnit {
  value: number;
  label: string;
}

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
}

function calculateTimeLeft(targetDate: Date): TimeUnit[] {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const difference = target - now;

  if (difference <= 0) {
    return [
      { value: 0, label: 'Days' },
      { value: 0, label: 'Hours' },
      { value: 0, label: 'Minutes' },
      { value: 0, label: 'Seconds' },
    ];
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return [
    { value: days, label: 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Minutes' },
    { value: seconds, label: 'Seconds' },
  ];
}

function TimeBox({ value, label, isChanging }: { value: number; label: string; isChanging: boolean }) {
  const displayValue = value.toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          relative w-16 h-20 md:w-20 md:h-24
          bg-dark-900/80 border border-dark-700/50
          rounded-2xl flex items-center justify-center
          shadow-lg shadow-cyan-500/10
          overflow-hidden
          ${isChanging ? 'animate-pulse' : ''}
        `}
      >
        <span
          className={`
            text-3xl md:text-4xl font-bold font-mono
            bg-gradient-to-b from-cyan-400 to-teal-500
            bg-clip-text text-transparent
            transition-transform duration-200
            ${isChanging ? 'scale-110' : 'scale-100'}
          `}
        >
          {displayValue}
        </span>
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      </div>
      <span className="mt-2 text-xs md:text-sm text-slate-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export function CountdownTimer({ targetDate, onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeUnit[]>(() => calculateTimeLeft(targetDate));
  const [prevValues, setPrevValues] = useState<number[]>([0, 0, 0, 0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate);
      setPrevValues(timeLeft.map(t => t.value));
      setTimeLeft(newTimeLeft);

      // Check if countdown is complete
      if (newTimeLeft.every(t => t.value === 0)) {
        onComplete?.();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete, timeLeft]);

  // SSR-safe: show placeholder until mounted
  if (!mounted) {
    return (
      <div className="flex justify-center gap-3 md:gap-4">
        {['Days', 'Hours', 'Minutes', 'Seconds'].map((label) => (
          <div key={label} className="flex flex-col items-center">
            <div className="w-16 h-20 md:w-20 md:h-24 bg-dark-900/80 border border-dark-700/50 rounded-2xl animate-pulse" />
            <span className="mt-2 text-xs md:text-sm text-slate-500 uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-3 md:gap-4" aria-live="polite" aria-atomic="true">
      {timeLeft.map((unit, index) => (
        <TimeBox
          key={unit.label}
          value={unit.value}
          label={unit.label}
          isChanging={prevValues[index] !== unit.value}
        />
      ))}
    </div>
  );
}
