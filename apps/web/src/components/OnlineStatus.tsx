'use client';

import {
  useUserPresence,
  formatLastSeen,
  getStatusColor,
  getStatusGlow,
  getStatusText,
  UserStatus,
} from '@/store/presenceStore';

interface OnlineStatusProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showLastSeen?: boolean;
}

export function OnlineStatus({
  userId,
  size = 'md',
  showLabel = false,
  showLastSeen = true,
}: OnlineStatusProps) {
  const presence = useUserPresence(userId);

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const dotClass = sizeClasses[size];
  const colorClass = getStatusColor(presence.status);
  const glowClass = getStatusGlow(presence.status);

  const getLabel = () => {
    if (presence.status === 'active') {
      return 'Online';
    }
    if (presence.status === 'away') {
      return 'Away';
    }
    if (presence.status === 'do_not_disturb') {
      return 'Do Not Disturb';
    }
    // Offline - show last seen if available
    if (showLastSeen && presence.lastActive) {
      return `Last seen ${formatLastSeen(presence.lastActive)}`;
    }
    return 'Offline';
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${dotClass} rounded-full ${colorClass} ${glowClass}`}
        title={getStatusText(presence.status)}
      />
      {showLabel && (
        <span className="text-sm text-zinc-400">
          {getLabel()}
        </span>
      )}
    </div>
  );
}

interface StatusDotProps {
  status: UserStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showGlow?: boolean;
}

export function StatusDot({
  status,
  size = 'md',
  className = '',
  showGlow = true,
}: StatusDotProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const colorClass = getStatusColor(status);
  const glowClass = showGlow ? getStatusGlow(status) : '';

  return (
    <span
      className={`${sizeClasses[size]} rounded-full ${colorClass} ${glowClass} ${className}`}
      title={getStatusText(status)}
    />
  );
}

interface OnlineDotProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OnlineDot({
  isOnline,
  size = 'md',
  className = '',
}: OnlineDotProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded-full border-2 border-zinc-900 ${
        isOnline ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-zinc-500'
      } ${className}`}
    />
  );
}

/**
 * Avatar with presence indicator overlay.
 */
interface AvatarWithPresenceProps {
  userId: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarWithPresence({
  userId,
  name,
  size = 'md',
  className = '',
}: AvatarWithPresenceProps) {
  const presence = useUserPresence(userId);

  const containerSizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const dotSizes = {
    sm: 'h-2 w-2 -right-0.5 -bottom-0.5',
    md: 'h-3 w-3 -right-0.5 -bottom-0.5',
    lg: 'h-3.5 w-3.5 -right-0.5 -bottom-0.5',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Get initials from name
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorClass = getStatusColor(presence.status);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`${containerSizes[size]} rounded-full bg-zinc-700 flex items-center justify-center`}
      >
        <span className={`${textSizes[size]} font-medium text-zinc-200`}>
          {initials}
        </span>
      </div>
      <span
        className={`absolute ${dotSizes[size]} rounded-full border-2 border-zinc-900 ${colorClass}`}
        title={getStatusText(presence.status)}
      />
    </div>
  );
}

/**
 * Hook to get formatted last seen string for a user.
 */
export function useLastSeen(userId: string): string {
  const presence = useUserPresence(userId);

  if (presence.status === 'active') return 'Online';
  if (presence.status === 'away') return 'Away';
  if (presence.status === 'do_not_disturb') return 'Do Not Disturb';
  if (presence.lastActive) return `Last seen ${formatLastSeen(presence.lastActive)}`;
  return 'Offline';
}

export default OnlineStatus;
