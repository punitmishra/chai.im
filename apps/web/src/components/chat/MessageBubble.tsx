'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Message, useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getWebSocketClient } from '@/lib/ws/client';
import { MessageContent } from './MessageContent';
import { AttachmentDisplay } from './AttachmentDisplay';
import { ReactionPicker } from '@/components/ReactionPicker';

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  conversationId: string;
  onOpenThread?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  showThreadIndicator?: boolean;
  threadReplyCount?: number;
  isSelected?: boolean;
  onSelect?: (messageId: string) => void;
  senderName?: string;
  showSenderName?: boolean;
}

interface MessageAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function MessageBubble({
  message,
  isSelf,
  conversationId,
  onOpenThread,
  onEdit,
  showThreadIndicator = false,
  threadReplyCount = 0,
  isSelected = false,
  onSelect,
  senderName,
  showSenderName = false,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((state) => state.user);
  const addReaction = useChatStore((state) => state.addReaction);
  const removeReaction = useChatStore((state) => state.removeReaction);

  const timestamp = new Date(message.timestamp);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
        setShowReactionPicker(false);
      }
    };

    if (showActionsMenu || showReactionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsMenu, showReactionPicker]);

  // Handle reaction
  const handleReaction = useCallback(
    (emoji: string) => {
      const existingReaction = message.reactions?.find(
        (r) => r.userId === user?.id && r.emoji === emoji
      );

      if (existingReaction) {
        removeReaction(message.id, user?.id || '', emoji);
        getWebSocketClient().removeReaction(message.id, conversationId, emoji);
      } else {
        addReaction(message.id, user?.id || '', emoji);
        getWebSocketClient().addReaction(message.id, conversationId, emoji);
      }
      setShowReactionPicker(false);
    },
    [message.id, message.reactions, user?.id, conversationId, addReaction, removeReaction]
  );

  // Copy message text
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowActionsMenu(false);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.content]);

  // Group reactions by emoji
  const reactionGroups = useMemo(() => {
    if (!message.reactions?.length) return [];
    const groups = new Map<string, string[]>();
    for (const r of message.reactions) {
      const existing = groups.get(r.emoji) || [];
      existing.push(r.userId);
      groups.set(r.emoji, existing);
    }
    return Array.from(groups.entries());
  }, [message.reactions]);

  // Message actions
  const actions: MessageAction[] = useMemo(
    () => [
      {
        id: 'thread',
        label: 'Reply in thread',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        ),
        onClick: () => {
          onOpenThread?.(message.id);
          setShowActionsMenu(false);
        },
      },
      {
        id: 'reaction',
        label: 'Add reaction',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        onClick: () => {
          setShowReactionPicker(true);
          setShowActionsMenu(false);
        },
      },
      {
        id: 'copy',
        label: copied ? 'Copied!' : 'Copy text',
        icon: copied ? (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ),
        onClick: handleCopy,
      },
      ...(isSelf
        ? [
            {
              id: 'edit',
              label: 'Edit message',
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ),
              onClick: () => {
                onEdit?.(message.id);
                setShowActionsMenu(false);
              },
            },
          ]
        : []),
    ],
    [copied, handleCopy, isSelf, message.id, onEdit, onOpenThread]
  );

  return (
    <div
      className={`flex ${isSelf ? 'justify-end' : 'justify-start'} group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        if (!showActionsMenu && !showReactionPicker) {
          setShowActionsMenu(false);
        }
      }}
      onClick={() => onSelect?.(message.id)}
      data-message-id={message.id}
    >
      <div className={`relative max-w-[75%] ${isSelected ? 'ring-2 ring-amber-500/50 rounded-3xl' : ''}`}>
        {/* Sender name label for group messages */}
        {showSenderName && !isSelf && senderName && (
          <p className="text-xs text-purple-400 font-medium mb-1 ml-3">{senderName}</p>
        )}
        {/* Actions bar - appears on hover */}
        {showActions && (
          <div
            className={`absolute top-0 flex items-center gap-1 z-10 ${
              isSelf ? 'right-full mr-2' : 'left-full ml-2'
            }`}
          >
            {/* Quick reaction button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionPicker(!showReactionPicker);
              }}
              className="p-1.5 rounded-lg bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-all"
              title="Add reaction"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Thread reply button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenThread?.(message.id);
              }}
              className="p-1.5 rounded-lg bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-all"
              title="Reply in thread"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            {/* More actions button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionsMenu(!showActionsMenu);
                }}
                className="p-1.5 rounded-lg bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-all"
                title="More actions"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* Actions dropdown menu */}
              {showActionsMenu && (
                <div
                  className={`absolute top-full mt-1 py-1 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 ${
                    isSelf ? 'right-0' : 'left-0'
                  }`}
                >
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      disabled={action.disabled}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reaction picker popup */}
        {showReactionPicker && (
          <div
            className={`absolute bottom-full mb-2 z-50 ${isSelf ? 'right-0' : 'left-0'}`}
          >
            <ReactionPicker
              onSelect={handleReaction}
              onClose={() => setShowReactionPicker(false)}
            />
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-3xl px-5 py-3 ${
            isSelf
              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-zinc-800/70 text-white shadow-lg'
          }`}
        >
          {/* Message content with markdown */}
          <MessageContent content={message.content} isSelf={isSelf} />

          {/* File attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentDisplay attachments={message.attachments} isSelf={isSelf} />
          )}

          {/* Timestamp and status */}
          <div className="mt-2 flex items-center gap-2">
            <p className={`text-xs ${isSelf ? 'text-amber-900/70' : 'text-zinc-500'}`}>
              {timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {isSelf && <MessageStatus status={message.status} />}
          </div>
        </div>

        {/* Thread indicator */}
        {showThreadIndicator && threadReplyCount > 0 && (
          <button
            onClick={() => onOpenThread?.(message.id)}
            className={`mt-1 flex items-center gap-1.5 text-xs transition-colors ${
              isSelf
                ? 'text-amber-600 hover:text-amber-500 justify-end'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>
              {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
            </span>
          </button>
        )}

        {/* Reactions row */}
        {reactionGroups.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
            {reactionGroups.map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                  userIds.includes(user?.id || '')
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    : 'bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50 text-zinc-400'
                }`}
              >
                <span>{emoji}</span>
                {userIds.length > 1 && <span>{userIds.length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatus({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'sending':
      return (
        <div className="h-3 w-3 animate-spin rounded-full border border-amber-900/50 border-t-amber-900" />
      );
    case 'sent':
      return (
        <svg className="h-3.5 w-3.5 text-amber-900/70" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'delivered':
      return (
        <svg className="h-3.5 w-3.5 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'read':
      return (
        <svg className="h-3.5 w-3.5 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default MessageBubble;
