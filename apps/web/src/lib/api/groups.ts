/**
 * Groups API client for group management operations.
 */

import { useAuthStore } from '@/store/authStore';
import { API_URL } from '@/lib/config';

export interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  is_public: boolean;
  member_count: number;
  created_at: string;
}

export interface MemberResponse {
  user_id: string;
  role: string;
  joined_at: string;
}

export interface InviteResponse {
  invite_code: string;
  expires_at: string | null;
}

function getToken(): string {
  const token = useAuthStore.getState().sessionToken;
  if (!token) throw new Error('Not authenticated');
  return token;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

/**
 * List all groups the current user is a member of.
 */
export async function listMyGroups(): Promise<GroupResponse[]> {
  const response = await fetch(`${API_URL}/groups`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse<{ groups: GroupResponse[] }>(response);
  return data.groups;
}

/**
 * Create a new group.
 */
export async function createGroup(
  name: string,
  description?: string,
  isPublic?: boolean
): Promise<GroupResponse> {
  const response = await fetch(`${API_URL}/groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description, is_public: isPublic ?? false }),
  });
  return handleResponse<GroupResponse>(response);
}

/**
 * Get group details by ID.
 */
export async function getGroup(groupId: string): Promise<GroupResponse> {
  const response = await fetch(`${API_URL}/groups/${groupId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return handleResponse<GroupResponse>(response);
}

/**
 * Update group details (admin only).
 */
export async function updateGroup(
  groupId: string,
  updates: { name?: string; description?: string; avatar_url?: string }
): Promise<GroupResponse> {
  const response = await fetch(`${API_URL}/groups/${groupId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse<GroupResponse>(response);
}

/**
 * Delete a group (owner only).
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const response = await fetch(`${API_URL}/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || 'Delete failed');
  }
}

/**
 * List members of a group.
 */
export async function listMembers(groupId: string): Promise<MemberResponse[]> {
  const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse<{ members: MemberResponse[] }>(response);
  return data.members;
}

/**
 * Add a member to a group (admin only).
 */
export async function addMember(
  groupId: string,
  userId: string,
  role?: string
): Promise<MemberResponse> {
  const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId, role: role ?? 'member' }),
  });
  return handleResponse<MemberResponse>(response);
}

/**
 * Remove a member from a group (admin or self).
 */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_URL}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Remove failed' }));
    throw new Error(error.error || 'Remove failed');
  }
}

/**
 * Search public groups by name.
 */
export async function searchPublicGroups(
  query: string,
  limit: number = 20
): Promise<GroupResponse[]> {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });
  const response = await fetch(`${API_URL}/groups/search?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse<{ groups: GroupResponse[] }>(response);
  return data.groups;
}

/**
 * Create an invite link for a group.
 */
export async function createInvite(
  groupId: string,
  maxUses?: number,
  expiresInHours?: number
): Promise<InviteResponse> {
  const response = await fetch(`${API_URL}/groups/${groupId}/invites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ max_uses: maxUses, expires_in_hours: expiresInHours }),
  });
  return handleResponse<InviteResponse>(response);
}

/**
 * Join a group using an invite code.
 */
export async function joinByCode(code: string): Promise<GroupResponse> {
  const response = await fetch(`${API_URL}/groups/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  return handleResponse<GroupResponse>(response);
}
