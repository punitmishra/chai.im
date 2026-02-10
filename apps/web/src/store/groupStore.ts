import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  listMyGroups,
  getGroup as getGroupApi,
  listMembers as listMembersApi,
  addMember as addMemberApi,
  removeMember as removeMemberApi,
  updateGroup as updateGroupApi,
  deleteGroup as deleteGroupApi,
  type GroupResponse,
} from '@/lib/api/groups';
import { getUserProfile } from '@/lib/api/users';
import { useAuthStore } from '@/store/authStore';

export interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  role: string;
  joinedAt: string;
}

function toGroupDetails(g: GroupResponse): GroupDetails {
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

interface GroupState {
  groups: GroupDetails[];
  members: Record<string, GroupMember[]>;
  isLoading: boolean;

  fetchMyGroups: () => Promise<void>;
  fetchGroupDetails: (groupId: string) => Promise<GroupDetails>;
  fetchMembers: (groupId: string) => Promise<GroupMember[]>;
  addMember: (groupId: string, userId: string, role?: string) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  updateGroup: (groupId: string, updates: { name?: string; description?: string }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;

  getGroup: (groupId: string) => GroupDetails | undefined;
  getMembers: (groupId: string) => GroupMember[];
  isAdmin: (groupId: string) => boolean;
  isOwner: (groupId: string) => boolean;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
      groups: [],
      members: {},
      isLoading: false,

      fetchMyGroups: async () => {
        set({ isLoading: true });
        try {
          const groups = await listMyGroups();
          set({ groups: groups.map(toGroupDetails) });
        } catch (e) {
          console.error('Failed to fetch groups:', e);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchGroupDetails: async (groupId) => {
        const data = await getGroupApi(groupId);
        const details = toGroupDetails(data);
        set((state) => {
          const existing = state.groups.findIndex((g) => g.id === groupId);
          if (existing >= 0) {
            const groups = [...state.groups];
            groups[existing] = details;
            return { groups };
          }
          return { groups: [...state.groups, details] };
        });
        return details;
      },

      fetchMembers: async (groupId) => {
        const raw = await listMembersApi(groupId);
        const members: GroupMember[] = await Promise.all(
          raw.map(async (m) => {
            let username = m.user_id.slice(0, 8);
            try {
              const profile = await getUserProfile(m.user_id);
              username = profile.username;
            } catch {
              // fallback to truncated ID
            }
            return {
              userId: m.user_id,
              username,
              role: m.role,
              joinedAt: m.joined_at,
            };
          })
        );
        set((state) => ({
          members: { ...state.members, [groupId]: members },
        }));
        return members;
      },

      addMember: async (groupId, userId, role) => {
        await addMemberApi(groupId, userId, role);
        // Refresh members list
        await get().fetchMembers(groupId);
      },

      removeMember: async (groupId, userId) => {
        await removeMemberApi(groupId, userId);
        set((state) => ({
          members: {
            ...state.members,
            [groupId]: (state.members[groupId] || []).filter((m) => m.userId !== userId),
          },
        }));
      },

      updateGroup: async (groupId, updates) => {
        const data = await updateGroupApi(groupId, updates);
        const details = toGroupDetails(data);
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? details : g)),
        }));
      },

      deleteGroup: async (groupId) => {
        await deleteGroupApi(groupId);
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
          members: Object.fromEntries(
            Object.entries(state.members).filter(([k]) => k !== groupId)
          ),
        }));
      },

      leaveGroup: async (groupId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;
        await removeMemberApi(groupId, userId);
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
          members: Object.fromEntries(
            Object.entries(state.members).filter(([k]) => k !== groupId)
          ),
        }));
      },

      getGroup: (groupId) => get().groups.find((g) => g.id === groupId),

      getMembers: (groupId) => get().members[groupId] || [],

      isAdmin: (groupId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return false;
        const members = get().members[groupId] || [];
        const me = members.find((m) => m.userId === userId);
        return me?.role === 'admin';
      },

      isOwner: (groupId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return false;
        const group = get().groups.find((g) => g.id === groupId);
        return group?.ownerId === userId;
      },
    }),
    {
      name: 'chai-groups',
      partialize: (state) => ({ groups: state.groups }),
    }
  )
);
