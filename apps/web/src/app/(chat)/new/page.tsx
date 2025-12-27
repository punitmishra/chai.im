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
  const startConversation = useCallback((user: UserSearchResult) => {
    // Check if conversation already exists
    const existing = conversations.find((c) => c.recipientId === user.id);
    if (existing) {
      router.push(`/${existing.id}`);
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

    router.push(`/${conversationId}`);
  }, [conversations, addConversation, router]);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800/50 p-6">
        <h1 className="text-xl font-semibold text-white">New Conversation</h1>
        <p className="text-sm text-zinc-500 mt-1">Search for a user to start chatting</p>
      </div>

      {/* Search input */}
      <div className="border-b border-zinc-800/50 p-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username..."
            className="w-full pl-12 pr-12 py-3.5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
            autoFocus
          />
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
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
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!error && query.length < 2 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-zinc-900/50 mb-6">
              <svg
                className="w-10 h-10 text-zinc-600"
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
            </div>
            <p className="text-zinc-500">Type at least 2 characters to search for users</p>
          </div>
        )}

        {!error && query.length >= 2 && results.length === 0 && !isSearching && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-zinc-900/50 mb-6">
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
            </div>
            <p className="text-zinc-500">No users found matching "{query}"</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((user) => {
              const hasExisting = conversations.some((c) => c.recipientId === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => startConversation(user)}
                  className="flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 hover:bg-zinc-800/50 group"
                >
                  {/* Avatar */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-400 font-semibold text-lg shadow-inner">
                    {user.username[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-lg">{user.username}</div>
                    <div className="text-sm text-zinc-500">
                      {hasExisting ? 'Continue conversation' : 'Start a new chat'}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="p-2 rounded-xl bg-zinc-800/50 text-zinc-500 group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-all duration-200">
                    <svg
                      className="h-5 w-5"
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
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
