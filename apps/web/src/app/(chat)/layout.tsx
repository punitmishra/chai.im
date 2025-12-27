'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useConnectionStore } from '@/store/connectionStore';
import { connectIfAuthenticated, getWebSocketClient } from '@/lib/ws/client';
import { clearCrypto } from '@/lib/crypto/wasm';
import { CreateGroupModal } from '@/components/CreateGroupModal';

// Self-chat conversation ID prefix
const SELF_CHAT_PREFIX = 'self_';
const GROUP_CHAT_PREFIX = 'group_';

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  memberCount?: number;
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const conversations = useChatStore((state) => state.conversations);
  const addConversation = useChatStore((state) => state.addConversation);
  const user = useAuthStore((state) => state.user);
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const connectionStatus = useConnectionStore((state) => state.status);

  // Fetch user's groups
  const fetchGroups = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/groups/me`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }, [sessionToken]);

  // Fetch groups when authenticated
  useEffect(() => {
    if (sessionToken) {
      fetchGroups();
    }
  }, [sessionToken, fetchGroups]);

  // Handle group creation
  const handleGroupCreated = useCallback((group: GroupInfo) => {
    setGroups((prev) => [group, ...prev]);
    // Add to conversations list
    addConversation({
      id: `${GROUP_CHAT_PREFIX}${group.id}`,
      name: group.name,
      recipientId: group.id,
      participants: [],
      unreadCount: 0,
      hasSession: true,
    });
  }, [addConversation]);

  // Redirect to login if not authenticated (only after store has hydrated)
  useEffect(() => {
    if (hasHydrated && !sessionToken) {
      router.push('/auth/login');
    }
  }, [hasHydrated, sessionToken, router]);

  // Create self-chat conversation if it doesn't exist
  useEffect(() => {
    if (hasHydrated && user && sessionToken) {
      const selfChatId = `${SELF_CHAT_PREFIX}${user.id}`;
      const hasSelfChat = conversations.some((c) => c.id === selfChatId);

      if (!hasSelfChat) {
        addConversation({
          id: selfChatId,
          name: 'Notes to Self',
          recipientId: user.id,
          participants: [user.id],
          unreadCount: 0,
          hasSession: true, // Self-chat doesn't need encryption session
        });
      }
    }
  }, [hasHydrated, user, sessionToken, conversations, addConversation]);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (sessionToken) {
      connectIfAuthenticated();
    }
  }, [sessionToken]);

  // Show loading during hydration or if not authenticated
  if (!hasHydrated || !sessionToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const isOnline = connectionStatus === 'connected';

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } flex flex-col border-r border-zinc-800/50 bg-zinc-900/30 backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-sm">☕</span>
            </div>
            <span className="text-lg font-semibold">
              <span className="text-amber-400">Chai</span>
              <span className="text-zinc-500">.im</span>
            </span>
          </Link>
          <div className="flex gap-1">
            {activeTab === 'groups' ? (
              <button
                onClick={() => setShowCreateGroup(true)}
                className="p-2.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 transition-all duration-200 text-zinc-400 hover:text-white hover:scale-105 active:scale-95"
                title="Create group"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            ) : (
              <Link
                href="/new"
                className="p-2.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 transition-all duration-200 text-zinc-400 hover:text-white hover:scale-105 active:scale-95"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800/50">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chats'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'groups'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Groups {groups.length > 0 && `(${groups.length})`}
          </button>
        </div>

        {/* Conversation/Group list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {activeTab === 'chats' ? (
            // Chats tab
            conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500 mb-3">No conversations yet</p>
                <Link
                  href="/new"
                  className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Start a new chat
                </Link>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelfChat = conv.id.startsWith(SELF_CHAT_PREFIX);
                const isGroupChat = conv.id.startsWith(GROUP_CHAT_PREFIX);
                return (
                  <Link
                    key={conv.id}
                    href={`/${conv.id}`}
                    className={`flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 ${
                      pathname === `/${conv.id}`
                        ? 'bg-zinc-800/70 shadow-lg'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {isSelfChat ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 font-medium text-black text-lg shadow-lg shadow-amber-500/20">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                      ) : isGroupChat ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 font-medium text-white text-lg shadow-lg shadow-purple-500/20">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 font-medium text-white text-lg shadow-inner">
                          {conv.name[0].toUpperCase()}
                        </div>
                      )}
                      {pathname === `/${conv.id}` && !isSelfChat && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-zinc-900" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white truncate">{conv.name}</span>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-black">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-zinc-500 mt-0.5">
                        {conv.lastMessage || (isSelfChat ? 'Your private notes' : isGroupChat ? 'Group chat' : 'No messages yet')}
                      </p>
                    </div>
                  </Link>
                );
              })
            )
          ) : (
            // Groups tab
            groups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500 mb-3">No groups yet</p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create a group
                </button>
              </div>
            ) : (
              groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/${GROUP_CHAT_PREFIX}${group.id}`}
                  className={`flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 ${
                    pathname === `/${GROUP_CHAT_PREFIX}${group.id}`
                      ? 'bg-zinc-800/70 shadow-lg'
                      : 'hover:bg-zinc-800/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 font-medium text-white text-lg shadow-lg shadow-purple-500/20">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    {group.isPublic && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-zinc-900 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate">{group.name}</span>
                      {group.memberCount && (
                        <span className="text-xs text-zinc-500">
                          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-zinc-500 mt-0.5">
                      {group.description || (group.isPublic ? 'Public group' : 'Private group')}
                    </p>
                  </div>
                </Link>
              ))
            )
          )}
        </div>

        {/* User section */}
        <div className="border-t border-zinc-800/50 p-4">
          <div className="flex items-center gap-3 rounded-2xl p-3 bg-zinc-800/30">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 font-semibold text-black shadow-lg shadow-amber-500/20">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-800 ${isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{user?.username || 'User'}</div>
              <div className="text-xs text-zinc-500">{isOnline ? 'Online' : 'Connecting...'}</div>
            </div>
            <button
              onClick={() => {
                getWebSocketClient().disconnect();
                clearCrypto();
                useAuthStore.getState().logout();
                router.push('/auth/login');
              }}
              className="p-2.5 rounded-xl hover:bg-zinc-700/50 text-zinc-500 hover:text-white transition-all duration-200"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Toggle sidebar button (mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-amber-500 text-black shadow-xl shadow-amber-500/30 md:hidden hover:bg-amber-400 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-zinc-950">{children}</main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />
    </div>
  );
}
