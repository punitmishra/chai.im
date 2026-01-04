'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getWebSocketClient } from '@/lib/ws/client';
import { clearCrypto } from '@/lib/crypto/wasm';

interface Command {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'navigation' | 'actions' | 'settings' | 'ai';
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
  onOpenCreateGroup: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenSearch,
  onOpenCreateGroup,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const conversations = useChatStore((state) => state.conversations);
  const user = useAuthStore((state) => state.user);

  // Define commands
  const commands = useMemo<Command[]>(() => {
    const baseCommands: Command[] = [
      // Navigation
      {
        id: 'search',
        name: 'Search messages',
        description: 'Find messages across all conversations',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
        category: 'navigation',
        shortcut: '/',
        action: () => {
          onClose();
          onOpenSearch();
        },
      },
      {
        id: 'new-chat',
        name: 'New conversation',
        description: 'Start a new encrypted chat',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        ),
        category: 'navigation',
        shortcut: 'N',
        action: () => {
          onClose();
          router.push('/new');
        },
      },
      {
        id: 'create-group',
        name: 'Create group',
        description: 'Create a new group chat',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        category: 'actions',
        shortcut: 'G',
        action: () => {
          onClose();
          onOpenCreateGroup();
        },
      },
      {
        id: 'notes',
        name: 'Notes to Self',
        description: 'Your private notes',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        category: 'navigation',
        action: () => {
          onClose();
          if (user?.id) {
            router.push(`/self_${user.id}`);
          }
        },
      },
      // Settings
      {
        id: 'shortcuts',
        name: 'Keyboard shortcuts',
        description: 'View all keyboard shortcuts',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
        category: 'settings',
        shortcut: '?',
        action: () => {
          onClose();
          // TODO: Open shortcuts modal
          alert('Keyboard shortcuts: Ctrl+K (palette), Ctrl+/ (search), J/K (navigate), T (thread)');
        },
      },
      {
        id: 'logout',
        name: 'Sign out',
        description: 'Log out of your account',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        ),
        category: 'settings',
        action: () => {
          onClose();
          getWebSocketClient().disconnect();
          clearCrypto();
          useAuthStore.getState().logout();
          router.push('/auth/login');
        },
      },
    ];

    // Add conversation quick-jump commands
    const conversationCommands: Command[] = conversations.slice(0, 5).map((conv) => ({
      id: `conv-${conv.id}`,
      name: conv.name,
      description: conv.lastMessage || 'No messages yet',
      icon: (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-xs font-medium text-white">
          {conv.name.charAt(0).toUpperCase()}
        </div>
      ),
      category: 'navigation' as const,
      action: () => {
        onClose();
        router.push(`/${conv.id}`);
      },
    }));

    return [...baseCommands, ...conversationCommands];
  }, [conversations, user?.id, router, onClose, onOpenSearch, onOpenCreateGroup]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
    ai: 'AI Features',
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 bg-zinc-800 rounded">
            ESC
          </kbd>
        </div>

        {/* Commands */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
              <p>No commands found</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {categoryLabels[category] || category}
                </div>
                {cmds.map((cmd) => {
                  const index = currentIndex++;
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                        index === selectedIndex
                          ? 'bg-zinc-800'
                          : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="text-zinc-400">{cmd.icon}</div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-white">{cmd.name}</div>
                        <div className="text-xs text-zinc-500 truncate">{cmd.description}</div>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-1 text-xs text-zinc-500 bg-zinc-800 rounded">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-500">
            {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</kbd>
              run
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
