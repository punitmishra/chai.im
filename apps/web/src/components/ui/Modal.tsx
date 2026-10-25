'use client';

import { useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';

const widthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Hidden accessible label when there is no visible title. */
  ariaLabel?: string;
  size?: keyof typeof widthMap;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible modal dialog: backdrop + scrim, role="dialog" aria-modal,
 * Escape to close, click-outside to close, focus moved in and restored on close.
 */
export function Modal({ open, onClose, title, ariaLabel, size = 'md', children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onKeyDown);
    // Move focus into the dialog.
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={clsx(
          'relative w-full rounded-2xl border border-dark-700 bg-dark-900 shadow-2xl shadow-black/50 focus:outline-none',
          widthMap[size],
          className
        )}
      >
        {title && (
          <div className="border-b border-dark-700 px-6 py-4">
            <h2 id="modal-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
