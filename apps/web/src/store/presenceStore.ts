import { create } from 'zustand';

/**
 * User presence status (must match server enum).
 */
export type UserStatus = 'active' | 'away' | 'do_not_disturb' | 'offline';

/**
 * Presence information for a user.
 */
export interface PresenceInfo {
  status: UserStatus;
  /** Unix timestamp in milliseconds of last activity (for offline/away users). */
  lastActive: number | null;
  /** When we last received a presence update for this user. */
  updatedAt: number;
}

interface PresenceState {
  /** Map of user ID to presence info. */
  presence: Map<string, PresenceInfo>;
  /** Set of user IDs we're currently subscribed to. */
  subscriptions: Set<string>;
  /** Activity timeout handle for auto-away detection. */
  activityTimeoutId: number | null;

  // Actions
  updatePresence: (userId: string, status: UserStatus, lastActive: number | null) => void;
  setOffline: (userId: string, lastActive: number | null) => void;
  subscribe: (userIds: string[]) => void;
  unsubscribe: (userIds: string[]) => void;
  clearPresence: () => void;

  // Selectors (for use in components)
  getPresence: (userId: string) => PresenceInfo | undefined;
  isOnline: (userId: string) => boolean;
  getOnlineUsers: () => string[];
}

const DEFAULT_PRESENCE: PresenceInfo = {
  status: 'offline',
  lastActive: null,
  updatedAt: 0,
};

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presence: new Map(),
  subscriptions: new Set(),
  activityTimeoutId: null,

  updatePresence: (userId, status, lastActive) => {
    set((state) => {
      const newPresence = new Map(state.presence);
      newPresence.set(userId, {
        status,
        lastActive,
        updatedAt: Date.now(),
      });
      return { presence: newPresence };
    });
  },

  setOffline: (userId, lastActive) => {
    set((state) => {
      const newPresence = new Map(state.presence);
      const existing = newPresence.get(userId);
      newPresence.set(userId, {
        status: 'offline',
        lastActive: lastActive ?? existing?.lastActive ?? null,
        updatedAt: Date.now(),
      });
      return { presence: newPresence };
    });
  },

  subscribe: (userIds) => {
    set((state) => {
      const newSubs = new Set(state.subscriptions);
      userIds.forEach(id => newSubs.add(id));
      return { subscriptions: newSubs };
    });
  },

  unsubscribe: (userIds) => {
    set((state) => {
      const newSubs = new Set(state.subscriptions);
      userIds.forEach(id => newSubs.delete(id));
      return { subscriptions: newSubs };
    });
  },

  clearPresence: () => {
    set({
      presence: new Map(),
      subscriptions: new Set(),
    });
  },

  getPresence: (userId) => {
    return get().presence.get(userId);
  },

  isOnline: (userId) => {
    const presence = get().presence.get(userId);
    return presence?.status === 'active' || presence?.status === 'away';
  },

  getOnlineUsers: () => {
    const onlineUsers: string[] = [];
    get().presence.forEach((info, userId) => {
      if (info.status === 'active' || info.status === 'away') {
        onlineUsers.push(userId);
      }
    });
    return onlineUsers;
  },
}));

/**
 * Hook to get a specific user's presence info.
 */
export function useUserPresence(userId: string): PresenceInfo {
  return usePresenceStore((state) => state.presence.get(userId) ?? DEFAULT_PRESENCE);
}

/**
 * Hook to check if a user is online (active or away).
 */
export function useIsUserOnline(userId: string): boolean {
  return usePresenceStore((state) => {
    const presence = state.presence.get(userId);
    return presence?.status === 'active' || presence?.status === 'away';
  });
}

/**
 * Hook to get all online users.
 */
export function useOnlineUsers(): string[] {
  return usePresenceStore((state) => {
    const onlineUsers: string[] = [];
    state.presence.forEach((info, id) => {
      if (info.status === 'active' || info.status === 'away') {
        onlineUsers.push(id);
      }
    });
    return onlineUsers;
  });
}

/**
 * Format last seen time as human-readable string.
 */
export function formatLastSeen(lastActiveMs: number | null): string {
  if (!lastActiveMs) {
    return 'Offline';
  }

  const now = Date.now();
  const diff = now - lastActiveMs;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(lastActiveMs).toLocaleDateString();
  }
}

/**
 * Get status display text.
 */
export function getStatusText(status: UserStatus): string {
  switch (status) {
    case 'active':
      return 'Online';
    case 'away':
      return 'Away';
    case 'do_not_disturb':
      return 'Do Not Disturb';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
}

/**
 * Get status color class for Tailwind.
 */
export function getStatusColor(status: UserStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'away':
      return 'bg-yellow-500';
    case 'do_not_disturb':
      return 'bg-red-500';
    case 'offline':
      return 'bg-zinc-500';
    default:
      return 'bg-zinc-500';
  }
}

/**
 * Get status glow class for Tailwind (for active indicators).
 */
export function getStatusGlow(status: UserStatus): string {
  switch (status) {
    case 'active':
      return 'shadow-lg shadow-green-500/50';
    case 'away':
      return 'shadow-lg shadow-yellow-500/50';
    case 'do_not_disturb':
      return 'shadow-lg shadow-red-500/50';
    case 'offline':
      return '';
    default:
      return '';
  }
}
