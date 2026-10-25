import { clsx } from 'clsx';

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
} as const;

const dotSize = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
} as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof sizeMap;
  /** undefined = no presence dot; true = online; false = offline */
  online?: boolean;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Single, consistent avatar language (initials + optional presence dot). */
export function Avatar({ name, size = 'md', online, className }: AvatarProps) {
  return (
    <span className={clsx('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden
        className={clsx(
          'flex items-center justify-center rounded-2xl font-semibold text-dark-950',
          'bg-gradient-to-br from-primary-400 to-teal-500',
          sizeMap[size]
        )}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-dark-900',
            dotSize[size],
            online ? 'bg-emerald-500' : 'bg-dark-500'
          )}
          aria-label={online ? 'online' : 'offline'}
        />
      )}
    </span>
  );
}
