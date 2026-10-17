export function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-dark-700" />
          <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-cyan-500" />
        </div>
        <span className="text-slate-500">{message}</span>
      </div>
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <div className={`${sizes[size]} animate-spin rounded-full border-2 border-dark-600 border-t-cyan-500`} />
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-dark-800/50 rounded-xl ${className}`}
    />
  )
}
