'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const conversations = useChatStore((state) => state.conversations);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } flex flex-col border-r border-dark-800 bg-dark-900 transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-800 p-4">
          <Link href="/" className="text-xl font-bold">
            <span className="text-primary-500">Chai</span>
            <span className="text-dark-400">.im</span>
          </Link>
          <Link href="/chat/new" className="btn-ghost p-2">
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </Link>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-dark-400">
              <p className="text-sm">No conversations yet</p>
              <Link href="/chat/new" className="text-primary-500 text-sm hover:underline">
                Start a new chat
              </Link>
            </div>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                  pathname === `/chat/${conv.id}`
                    ? 'bg-dark-800'
                    : 'hover:bg-dark-800/50'
                }`}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dark-700 font-medium">
                    {conv.name[0].toUpperCase()}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 truncate">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{conv.name}</span>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-xs font-medium">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-dark-400">
                    {conv.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* User section */}
        <div className="border-t border-dark-800 p-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-dark-800"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 font-medium">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <div className="font-medium">{user?.username || 'User'}</div>
              <div className="text-sm text-dark-400">Settings</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
