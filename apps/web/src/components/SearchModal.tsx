'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useChatStore, Message, Conversation } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { LocalAI } from '@/lib/ai/local-ai';

interface SearchResult {
  message: Message;
  conversation: Conversation | undefined;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic';
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<'all' | 'semantic'>('all');
  const [aiAvailable, setAiAvailable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const messages = useChatStore((state) => state.messages);
  const conversations = useChatStore((state) => state.conversations);
  const user = useAuthStore((state) => state.user);

  // Check AI availability on mount
  useEffect(() => {
    const ai = LocalAI.getInstance();
    ai.initialize().then(() => {
      const caps = ai.getCapabilities();
      setAiAvailable(caps.semanticSearch);
    });
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
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
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            navigateToMessage(results[selectedIndex]);
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
  }, [isOpen, results, selectedIndex, onClose]);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const query = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Exact and fuzzy text search
    for (const message of messages) {
      const content = message.content.toLowerCase();
      const conversation = conversations.find((c) => c.id === message.conversationId);

      // Exact match
      if (content.includes(query)) {
        searchResults.push({
          message,
          conversation,
          score: content === query ? 1.0 : 0.8,
          matchType: 'exact',
        });
        continue;
      }

      // Fuzzy match (words)
      const queryWords = query.split(/\s+/);
      const matchedWords = queryWords.filter((word) => content.includes(word));
      if (matchedWords.length > 0) {
        searchResults.push({
          message,
          conversation,
          score: matchedWords.length / queryWords.length * 0.6,
          matchType: 'fuzzy',
        });
      }
    }

    // Semantic search if enabled and available
    if (searchMode === 'semantic' && aiAvailable) {
      try {
        const ai = LocalAI.getInstance();
        const messagesForAI = messages.map((m) => ({
          id: m.id,
          content: m.content,
          sender: m.senderId === user?.id ? 'You' : 'Other',
          timestamp: new Date(m.timestamp),
          isOwn: m.senderId === user?.id,
        }));

        const semanticResults = await ai.semanticSearch(searchQuery, messagesForAI, 10);

        for (const result of semanticResults) {
          const message = messages.find((m) => m.id === result.messageId);
          if (message) {
            const conversation = conversations.find((c) => c.id === message.conversationId);
            // Only add if not already in results
            if (!searchResults.some((r) => r.message.id === message.id)) {
              searchResults.push({
                message,
                conversation,
                score: result.score * 0.7, // Weight semantic slightly lower
                matchType: 'semantic',
              });
            }
          }
        }
      } catch (error) {
        console.error('Semantic search failed:', error);
      }
    }

    // Sort by score and limit results
    searchResults.sort((a, b) => b.score - a.score);
    setResults(searchResults.slice(0, 20));
    setSelectedIndex(0);
    setIsSearching(false);
  }, [messages, conversations, searchMode, aiAvailable, user?.id]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const navigateToMessage = (result: SearchResult) => {
    onClose();
    router.push(`/${result.message.conversationId}`);
    // TODO: Scroll to specific message
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-500/30 text-amber-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-white text-lg placeholder-zinc-500 focus:outline-none"
          />
          {isSearching && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 bg-zinc-800 rounded">
            ESC
          </kbd>
        </div>

        {/* Search mode toggle */}
        {aiAvailable && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-800/50 bg-zinc-900/50">
            <span className="text-xs text-zinc-500">Mode:</span>
            <button
              onClick={() => setSearchMode('all')}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                searchMode === 'all'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Text
            </button>
            <button
              onClick={() => setSearchMode('semantic')}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                searchMode === 'semantic'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Semantic (AI)
            </button>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query && results.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <svg className="w-12 h-12 mb-3 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>No messages found for "{query}"</p>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-zinc-800/50">
              {results.map((result, index) => (
                <button
                  key={result.message.id}
                  onClick={() => navigateToMessage(result)}
                  className={`w-full text-left px-5 py-3 transition-colors ${
                    index === selectedIndex
                      ? 'bg-zinc-800'
                      : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="font-medium text-white truncate">
                      {result.conversation?.name || 'Unknown'}
                    </span>
                    <div className="flex items-center gap-2">
                      {result.matchType === 'semantic' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                          AI
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">
                        {formatTimestamp(result.message.timestamp)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 truncate">
                    {highlightMatch(result.message.content, query)}
                  </p>
                </button>
              ))}
            </div>
          ) : !query ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <p className="text-sm">Type to search your messages</p>
              <p className="text-xs text-zinc-600 mt-1">
                Use arrow keys to navigate, Enter to select
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
            <span className="text-xs text-zinc-500">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</kbd>
                open
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchModal;
