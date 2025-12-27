import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GroupMember {
  userId: string;
  username?: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
  members?: GroupMember[];
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: number;
  replyToId?: string;
}

interface GroupState {
  groups: Group[];
  activeGroupId: string | null;
  messages: GroupMessage[];
  isLoading: boolean;

  // Actions
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  removeGroup: (id: string) => void;
  setActiveGroup: (id: string | null) => void;
  addMessage: (message: GroupMessage) => void;
  setMembers: (groupId: string, members: GroupMember[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
      groups: [],
      activeGroupId: null,
      messages: [],
      isLoading: false,

      setGroups: (groups) => set({ groups }),

      addGroup: (group) => {
        set((state) => {
          if (state.groups.find((g) => g.id === group.id)) {
            return state;
          }
          return { groups: [group, ...state.groups] };
        });
      },

      updateGroup: (id, updates) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
      },

      removeGroup: (id) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          messages: state.messages.filter((m) => m.groupId !== id),
        }));
      },

      setActiveGroup: (id) => set({ activeGroupId: id }),

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, message],
        }));
      },

      setMembers: (groupId, members) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, members, memberCount: members.length } : g
          ),
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'chai-groups',
      partialize: (state) => ({
        groups: state.groups,
        messages: state.messages.slice(-500), // Keep last 500 group messages
      }),
    }
  )
);

// API helper functions
const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchGroups(token: string): Promise<Group[]> {
  const response = await fetch(`${getApiUrl()}/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch groups');
  }

  const data = await response.json();
  return (data.groups || []).map((g: Record<string, unknown>) => ({
    id: g.id as string,
    name: g.name as string,
    description: g.description as string | null,
    avatarUrl: g.avatar_url as string | null,
    ownerId: g.owner_id as string,
    isPublic: g.is_public as boolean,
    memberCount: g.member_count as number,
    createdAt: g.created_at as string,
  }));
}

export async function fetchGroupMembers(token: string, groupId: string): Promise<GroupMember[]> {
  const response = await fetch(`${getApiUrl()}/groups/${groupId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch group members');
  }

  const data = await response.json();
  return (data.members || []).map((m: Record<string, unknown>) => ({
    userId: m.user_id as string,
    role: m.role as 'admin' | 'member',
    joinedAt: m.joined_at as string,
  }));
}

export async function createGroup(
  token: string,
  name: string,
  description?: string,
  isPublic?: boolean
): Promise<Group> {
  const response = await fetch(`${getApiUrl()}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      description: description || null,
      is_public: isPublic || false,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create group');
  }

  const g = await response.json();
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    avatarUrl: g.avatar_url,
    ownerId: g.owner_id,
    isPublic: g.is_public,
    memberCount: g.member_count,
    createdAt: g.created_at,
  };
}

export async function leaveGroup(token: string, groupId: string, userId: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to leave group');
  }
}

export async function joinGroupByCode(token: string, code: string): Promise<Group> {
  const response = await fetch(`${getApiUrl()}/groups/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to join group');
  }

  const g = await response.json();
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    avatarUrl: g.avatar_url,
    ownerId: g.owner_id,
    isPublic: g.is_public,
    memberCount: g.member_count,
    createdAt: g.created_at,
  };
}

export async function createInviteCode(
  token: string,
  groupId: string,
  maxUses?: number,
  expiresInHours?: number
): Promise<{ inviteCode: string; expiresAt: string | null }> {
  const response = await fetch(`${getApiUrl()}/groups/${groupId}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      max_uses: maxUses,
      expires_in_hours: expiresInHours,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create invite');
  }

  const data = await response.json();
  return {
    inviteCode: data.invite_code,
    expiresAt: data.expires_at,
  };
}
