import { forwardRef } from 'react';
import { clsx } from 'clsx';

type Variant = 'ghost' | 'solid' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center rounded-xl transition-all ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-dark-950 disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  ghost: 'text-dark-300 hover:bg-dark-800 hover:text-white',
  solid: 'bg-dark-800 text-white hover:bg-dark-700 border border-dark-600',
  danger: 'text-dark-300 hover:bg-red-500/15 hover:text-red-400',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name for the icon-only control. */
  'aria-label': string;
  variant?: Variant;
  size?: Size;
}

/** Icon-only button that forces an accessible name (fixes title-only a11y gaps). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', className, children, ...props },
  ref
) {
  return (
    <button ref={ref} className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
});
