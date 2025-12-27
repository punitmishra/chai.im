'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  emojiCategories,
  searchEmojis,
  getRecentEmojis,
  addRecentEmoji,
  type EmojiData,
  type EmojiCategory,
} from '@/lib/emoji';
import { getAllCustomEmojis, type CustomEmoji } from '@/lib/emoji/customEmoji';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
}

export function EmojiPicker({ onSelect, onClose, className = '' }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const [searchResults, setSearchResults] = useState<EmojiData[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Load recent and custom emojis on mount
  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
    getAllCustomEmojis().then(setCustomEmojis).catch(console.error);
  }, []);

  // Focus search on open
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearchResults(searchEmojis(searchQuery));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      addRecentEmoji(emoji);
      setRecentEmojis(getRecentEmojis());
      onSelect(emoji);
    },
    [onSelect]
  );

  const handleSelectCustomEmoji = useCallback(
    (emoji: CustomEmoji) => {
      // For custom emoji, we insert the shortcode
      onSelect(`:${emoji.shortcode}:`);
    },
    [onSelect]
  );

  const scrollToCategory = useCallback((categoryId: string) => {
    const element = categoryRefs.current.get(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveCategory(categoryId);
  }, []);

  const isSearching = searchQuery.length >= 2;

  return (
    <div
      ref={containerRef}
      className={`w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden ${className}`}
    >
      {/* Search bar */}
      <div className="p-3 border-b border-zinc-800">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis..."
          className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2
                     placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Category tabs */}
      {!isSearching && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-zinc-800 overflow-x-auto">
          {recentEmojis.length > 0 && (
            <button
              onClick={() => scrollToCategory('recent')}
              className={`p-2 rounded-lg text-lg hover:bg-zinc-800 transition-colors
                         ${activeCategory === 'recent' ? 'bg-zinc-800' : ''}`}
              title="Recent"
            >
              🕐
            </button>
          )}
          {emojiCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => scrollToCategory(category.id)}
              className={`p-2 rounded-lg text-lg hover:bg-zinc-800 transition-colors
                         ${activeCategory === category.id ? 'bg-zinc-800' : ''}`}
              title={category.name}
            >
              {category.icon}
            </button>
          ))}
          {customEmojis.length > 0 && (
            <button
              onClick={() => scrollToCategory('custom')}
              className={`p-2 rounded-lg text-lg hover:bg-zinc-800 transition-colors
                         ${activeCategory === 'custom' ? 'bg-zinc-800' : ''}`}
              title="Custom"
            >
              ⭐
            </button>
          )}
        </div>
      )}

      {/* Emoji grid */}
      <div className="h-64 overflow-y-auto p-2">
        {isSearching ? (
          // Search results
          <div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {searchResults.map((emoji, idx) => (
                  <button
                    key={`${emoji.emoji}-${idx}`}
                    onClick={() => handleSelectEmoji(emoji.emoji)}
                    className="p-2 text-xl hover:bg-zinc-800 rounded-lg transition-colors"
                    title={emoji.name}
                  >
                    {emoji.emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-8">No emojis found</div>
            )}
          </div>
        ) : (
          // Category view
          <div className="space-y-4">
            {/* Recent emojis */}
            {recentEmojis.length > 0 && (
              <div ref={(el) => { if (el) categoryRefs.current.set('recent', el); }}>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  Recently Used
                </h3>
                <div className="grid grid-cols-8 gap-1">
                  {recentEmojis.map((emoji, idx) => (
                    <button
                      key={`recent-${emoji}-${idx}`}
                      onClick={() => handleSelectEmoji(emoji)}
                      className="p-2 text-xl hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Standard emoji categories */}
            {emojiCategories.map((category) => (
              <div key={category.id} ref={(el) => { if (el) categoryRefs.current.set(category.id, el); }}>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  {category.name}
                </h3>
                <div className="grid grid-cols-8 gap-1">
                  {category.emojis.map((emoji, idx) => (
                    <button
                      key={`${category.id}-${emoji.emoji}-${idx}`}
                      onClick={() => handleSelectEmoji(emoji.emoji)}
                      className="p-2 text-xl hover:bg-zinc-800 rounded-lg transition-colors"
                      title={emoji.name}
                    >
                      {emoji.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Custom emojis */}
            {customEmojis.length > 0 && (
              <div ref={(el) => { if (el) categoryRefs.current.set('custom', el); }}>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  Custom
                </h3>
                <div className="grid grid-cols-8 gap-1">
                  {customEmojis.map((emoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => handleSelectCustomEmoji(emoji)}
                      className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                      title={`:${emoji.shortcode}:`}
                    >
                      <img
                        src={emoji.url}
                        alt={emoji.name}
                        className="w-5 h-5 object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
