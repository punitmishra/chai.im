'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { MessageBubble } from './MessageBubble';
import { EmojiPicker } from '@/components/EmojiPicker';
import { useEmojiAutocomplete, EmojiAutocompleteDropdown } from '@/hooks/useEmojiAutocomplete';

interface ThreadPanelProps {
  parentMessage: Message;
  threadReplies: Message[];
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSendReply: (content: string, parentMessageId: string) => Promise<void>;
}

export function ThreadPanel({
  parentMessage,
  threadReplies,
  conversationId,
  isOpen,
  onClose,
  onSendReply,
}: ThreadPanelProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((state) => state.user);
  const emojiAutocomplete = useEmojiAutocomplete();

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Scroll to bottom when replies change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadReplies]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set input ref for emoji autocomplete
  useEffect(() => {
    emojiAutocomplete.setInputRef(inputRef.current);
  }, [emojiAutocomplete]);

  // Handle input change with emoji autocomplete
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      emojiAutocomplete.handleInputChange(e);
    },
    [emojiAutocomplete]
  );

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, []);

  // Handle send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    setIsSending(true);
    const content = input;
    setInput('');

    try {
      await onSendReply(content, parentMessage.id);
    } catch (error) {
      console.error('Failed to send thread reply:', error);
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800/50 z-50 flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">Thread</h2>
              <p className="text-xs text-zinc-500">
                {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all"
            title="Close thread (Esc)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Parent message */}
          <div className="border-b border-zinc-800/50 pb-4 mb-4">
            <div className="text-xs text-zinc-500 mb-2 font-medium">Original message</div>
            <MessageBubble
              message={parentMessage}
              isSelf={parentMessage.senderId === user?.id}
              conversationId={conversationId}
            />
          </div>

          {/* Thread replies */}
          {threadReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-500 mb-1">No replies yet</p>
              <p className="text-xs text-zinc-600">Be the first to reply to this thread</p>
            </div>
          ) : (
            threadReplies.map((reply) => (
              <MessageBubble
                key={reply.id}
                message={reply}
                isSelf={reply.senderId === user?.id}
                conversationId={conversationId}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="border-t border-zinc-800/50 p-4 bg-zinc-900/80 backdrop-blur-xl">
          {/* Emoji autocomplete dropdown */}
          <div className="relative">
            {emojiAutocomplete.isActive && (
              <EmojiAutocompleteDropdown
                suggestions={emojiAutocomplete.suggestions}
                selectedIndex={emojiAutocomplete.selectedIndex}
                onSelect={(emoji) => {
                  emojiAutocomplete.selectEmoji(emoji);
                  inputRef.current?.focus();
                }}
              />
            )}

            {/* Emoji picker popup */}
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}

            <div className="flex gap-2">
              {/* Emoji picker button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={`p-3 rounded-xl transition-all duration-200 ${
                  showEmojiPicker
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                }`}
                title="Emoji picker"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={emojiAutocomplete.handleKeyDown}
                placeholder="Reply in thread..."
                className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />

              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
              >
                {isSending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

export default ThreadPanel;
