'use client';

import { useState, useRef, useEffect } from 'react';
import { quickReactions, addRecentEmoji } from '@/lib/emoji';
import { EmojiPicker } from './EmojiPicker';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
}

export function ReactionPicker({ onSelect, onClose, className = '' }: ReactionPickerProps) {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSelectReaction = (emoji: string) => {
    addRecentEmoji(emoji);
    onSelect(emoji);
    onClose?.();
  };

  const handleSelectFromPicker = (emoji: string) => {
    onSelect(emoji);
    onClose?.();
  };

  if (showFullPicker) {
    return (
      <div ref={containerRef} className={className}>
        <EmojiPicker onSelect={handleSelectFromPicker} onClose={onClose} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-full px-2 py-1.5 shadow-lg ${className}`}
    >
      {quickReactions.map((emojiData) => (
        <button
          key={emojiData.emoji}
          onClick={() => handleSelectReaction(emojiData.emoji)}
          className="p-1.5 text-lg hover:bg-zinc-800 rounded-full transition-colors hover:scale-110"
          title={emojiData.name}
        >
          {emojiData.emoji}
        </button>
      ))}
      <button
        onClick={() => setShowFullPicker(true)}
        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full transition-colors"
        title="More emojis"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Floating reaction picker that appears on hover/click of a message.
 */
interface MessageReactionPickerProps {
  messageId: string;
  onReact: (messageId: string, emoji: string) => void;
  existingReactions?: Array<{ emoji: string; count: number; hasReacted: boolean }>;
  className?: string;
}

export function MessageReactionPicker({
  messageId,
  onReact,
  existingReactions = [],
  className = '',
}: MessageReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = (emoji: string) => {
    onReact(messageId, emoji);
    setShowPicker(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Quick reaction button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
        title="Add reaction"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Picker popup */}
      {showPicker && (
        <div className="absolute bottom-full right-0 mb-2 z-50">
          <ReactionPicker onSelect={handleReact} onClose={() => setShowPicker(false)} />
        </div>
      )}

      {/* Existing reactions display */}
      {existingReactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {existingReactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => handleReact(reaction.emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm
                         ${
                           reaction.hasReacted
                             ? 'bg-amber-500/20 border border-amber-500/50'
                             : 'bg-zinc-800 border border-zinc-700'
                         } hover:bg-zinc-700 transition-colors`}
            >
              <span>{reaction.emoji}</span>
              <span className="text-xs text-zinc-400">{reaction.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReactionPicker;
