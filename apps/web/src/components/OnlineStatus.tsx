'use client';

import { useConnectionStore } from '@/store/connectionStore';

interface OnlineStatusProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function OnlineStatus({ userId, size = 'md', showLabel = false }: OnlineStatusProps) {
  // TODO: Implement proper presence tracking per user
  // For now, use connection status as a proxy
  const connectionStatus = useConnectionStore((state) => state.status);

  const isOnline = connectionStatus === 'connected';
  const lastSeen = undefined;

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const dotClass = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${dotClass} rounded-full ${
          isOnline ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-zinc-500'
        }`}
      />
      {showLabel && (
        <span className="text-sm text-zinc-400">
          {isOnline ? 'Online' : lastSeen ? formatLastSeen(lastSeen) : 'Offline'}
        </span>
      )}
    </div>
  );
}

export function OnlineDot({
  isOnline,
  size = 'md',
  className = '',
}: {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded-full border-2 border-zinc-900 ${
        isOnline ? 'bg-green-500' : 'bg-zinc-500'
      } ${className}`}
    />
  );
}

function formatLastSeen(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

export function useLastSeen(userId: string): string {
  // TODO: Implement proper presence tracking per user
  const connectionStatus = useConnectionStore((state) => state.status);

  if (connectionStatus === 'connected') return 'Online';
  return 'Offline';
}

export default OnlineStatus;
