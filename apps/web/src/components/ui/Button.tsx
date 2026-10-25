import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-dark-950 disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-primary-500 to-teal-500 text-dark-950 shadow-lg shadow-primary-500/20 ' +
    'hover:from-primary-400 hover:to-teal-400 hover:shadow-primary-500/30 active:scale-[0.98]',
  secondary:
    'bg-dark-800 text-white border border-dark-600 hover:bg-dark-700 hover:border-dark-500 active:scale-[0.98]',
  ghost: 'text-dark-200 hover:bg-dark-800 hover:text-white active:scale-[0.98]',
  danger:
    'bg-red-500/90 text-white hover:bg-red-500 shadow-lg shadow-red-500/20 active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-6 py-3',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

/** Primary interactive button. Collapses the ad-hoc gradient buttons across the app. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});
