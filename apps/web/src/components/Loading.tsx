import { Spinner } from '@/components/ui'

export function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" className="text-cyan-500" label={message} />
        <span className="text-slate-400">{message}</span>
      </div>
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <Spinner size={size} className="text-cyan-500" />
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-dark-800/50 rounded-xl ${className}`}
    />
  )
}
