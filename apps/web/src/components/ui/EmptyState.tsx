import { clsx } from 'clsx';

export interface EmptyStateProps {
  /** Decorative icon/illustration node (rendered aria-hidden). */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Consistent empty/zero state used across lists and panes. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <div
          aria-hidden
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800 text-primary-400"
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-dark-300">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
