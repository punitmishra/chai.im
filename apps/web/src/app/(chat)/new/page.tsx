'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchUsers, UserSearchResult } from '@/lib/api/users';
import { useChatStore } from '@/store/chatStore';

export default function NewChatPage() {
  const router = useRouter();
  const addConversation = useChatStore((state) => state.addConversation);
  const conversations = useChatStore((state) => state.conversations);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const users = await searchUsers(searchQuery);
      setResults(users);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Start a conversation with a user
  const startConversation = (user: UserSearchResult) => {
    // Check if conversation already exists
    const existing = conversations.find((c) => c.recipientId === user.id);
    if (existing) {
      router.push(`/chat/${existing.id}`);
      return;
    }

    // Create new conversation
    const conversationId = `conv_${user.id}`;
    addConversation({
      id: conversationId,
      name: user.username,
      recipientId: user.id,
      participants: [user.id],
      unreadCount: 0,
      hasSession: false,
    });

    router.push(`/chat/${conversationId}`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-dark-800 p-4">
        <h1 className="text-lg font-semibold">New Conversation</h1>
        <p className="text-sm text-dark-400">Search for a user to start chatting</p>
      </div>

      {/* Search input */}
      <div className="border-b border-dark-800 p-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username..."
            className="input w-full pl-10"
            autoFocus
          />
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-dark-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-dark-400 border-t-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!error && query.length < 2 && (
          <div className="text-center text-dark-400 py-8">
            <svg
              className="mx-auto h-12 w-12 mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p>Type at least 2 characters to search for users</p>
          </div>
        )}

        {!error && query.length >= 2 && results.length === 0 && !isSearching && (
          <div className="text-center text-dark-400 py-8">
            <p>No users found matching "{query}"</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => startConversation(user)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-dark-800"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/20 text-primary-500 font-medium">
                  {user.username[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="font-medium">{user.username}</div>
                  <div className="text-sm text-dark-400">
                    {conversations.some((c) => c.recipientId === user.id)
                      ? 'Existing conversation'
                      : 'Start a new chat'}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  className="h-5 w-5 text-dark-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
