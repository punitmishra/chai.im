import { clsx } from 'clsx';

const sizeMap = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const;

export interface SpinnerProps {
  size?: keyof typeof sizeMap;
  className?: string;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

/** A themed loading spinner (current accent color). */
export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={clsx(
        'inline-block animate-spin rounded-full border-current border-t-transparent',
        sizeMap[size],
        className
      )}
    />
  );
}
