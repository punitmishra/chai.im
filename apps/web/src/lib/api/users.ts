/**
 * Users API client for search and profile operations.
 */

import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface UserSearchResult {
  id: string;
  username: string;
}

export interface SearchUsersResponse {
  users: UserSearchResult[];
}

export interface UserProfile {
  id: string;
  username: string;
}

/**
 * Search for users by username.
 * Requires authentication.
 */
export async function searchUsers(
  query: string,
  limit: number = 20
): Promise<UserSearchResult[]> {
  const token = useAuthStore.getState().sessionToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });

  const response = await fetch(`${API_URL}/users/search?${params}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Search failed');
  }

  const data: SearchUsersResponse = await response.json();
  return data.users;
}

/**
 * Get a user's public profile by ID.
 * Requires authentication.
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const token = useAuthStore.getState().sessionToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/users/${userId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get user profile');
  }

  return response.json();
}
