'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChatStore, Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useConnectionStore } from '@/store/connectionStore';
import { useGroupStore } from '@/store/groupStore';
import { getWebSocketClient, connectIfAuthenticated } from '@/lib/ws/client';
import { EmojiPicker } from '@/components/EmojiPicker';
import { TypingIndicator } from '@/components/TypingIndicator';
import { MessageReactionPicker } from '@/components/ReactionPicker';
import { GroupMembersModal } from '@/components/GroupMembersModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useEmojiAutocomplete, EmojiAutocompleteDropdown } from '@/hooks/useEmojiAutocomplete';

// Chat type prefixes
const SELF_CHAT_PREFIX = 'self_';
const GROUP_CHAT_PREFIX = 'group_';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get state from stores
  const user = useAuthStore((state) => state.user);
  const connectionStatus = useConnectionStore((state) => state.status);
  const allMessages = useChatStore((state) => state.messages);
  const conversations = useChatStore((state) => state.conversations);
  const addMessage = useChatStore((state) => state.addMessage);
  const groups = useGroupStore((state) => state.groups);

  // Emoji autocomplete hook
  const emojiAutocomplete = useEmojiAutocomplete();

  // Keyboard shortcuts
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  // Check chat type
  const isSelfChat = conversationId.startsWith(SELF_CHAT_PREFIX);
  const isGroupChat = conversationId.startsWith(GROUP_CHAT_PREFIX);
  const groupId = isGroupChat ? conversationId.slice(GROUP_CHAT_PREFIX.length) : null;

  // Get group info if this is a group chat
  const group = useMemo(
    () => (groupId ? groups.find((g) => g.id === groupId) : null),
    [groups, groupId]
  );

  // Filter messages with useMemo to avoid infinite loop
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === conversationId),
    [allMessages, conversationId]
  );

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

  // Connect to WebSocket on mount (only for non-self chats)
  useEffect(() => {
    if (!isSelfChat) {
      connectIfAuthenticated();
    }
  }, [isSelfChat]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Request prekey bundle when starting a new conversation (only for 1:1 chats)
  useEffect(() => {
    if (conversation && !conversation.hasSession && !isSelfChat && !isGroupChat) {
      const client = getWebSocketClient();
      client.requestPrekeyBundle(conversation.recipientId);
    }
  }, [conversation, isSelfChat, isGroupChat]);

  // Register keyboard shortcuts
  useEffect(() => {
    registerShortcut({
      id: 'emoji-picker',
      keys: 'ctrl+shift+e',
      description: 'Toggle emoji picker',
      category: 'messaging',
      allowInInput: true,
      handler: () => setShowEmojiPicker((prev) => !prev),
    });

    registerShortcut({
      id: 'focus-input',
      keys: 'ctrl+i',
      description: 'Focus message input',
      category: 'general',
      allowInInput: false,
      handler: () => inputRef.current?.focus(),
    });

    registerShortcut({
      id: 'close-emoji',
      keys: 'escape',
      description: 'Close emoji picker',
      category: 'modals',
      allowInInput: true,
      handler: () => {
        if (showEmojiPicker) setShowEmojiPicker(false);
        if (emojiAutocomplete.isActive) emojiAutocomplete.close();
      },
    });

    return () => {
      unregisterShortcut('emoji-picker');
      unregisterShortcut('focus-input');
      unregisterShortcut('close-emoji');
    };
  }, [registerShortcut, unregisterShortcut, showEmojiPicker, emojiAutocomplete]);

  // Set input ref for emoji autocomplete
  useEffect(() => {
    emojiAutocomplete.setInputRef(inputRef.current);
  }, [emojiAutocomplete]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (isSelfChat || !conversation) return;

    const client = getWebSocketClient();
    const unsubscribe = client.onTyping((userId, convId, isTyping) => {
      if (convId === conversationId && userId === conversation.recipientId) {
        setPeerTyping(isTyping);
      }
    });

    return unsubscribe;
  }, [isSelfChat, conversation, conversationId]);

  // Handle typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    emojiAutocomplete.handleInputChange(e);

    // Send typing indicator (debounced)
    if (!isSelfChat && connectionStatus === 'connected' && conversation) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing start via WebSocket
      getWebSocketClient().sendTypingStart(conversation.recipientId, conversationId);

      typingTimeoutRef.current = setTimeout(() => {
        // Send typing stop via WebSocket
        if (conversation) {
          getWebSocketClient().sendTypingStop(conversation.recipientId, conversationId);
        }
      }, 2000);
    }
  }, [emojiAutocomplete, isSelfChat, connectionStatus, conversation, conversationId]);

  // Handle emoji selection from picker
  const handleEmojiSelect = useCallback((emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !conversation) return;

    setIsSending(true);
    const content = input;
    setInput('');

    try {
      if (isSelfChat) {
        // For self-chat, just add the message locally
        addMessage({
          id: `self-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conversationId,
          senderId: user?.id || '',
          content,
          timestamp: Date.now(),
          status: 'delivered',
        });
      } else {
        // For regular chats, send through WebSocket
        const client = getWebSocketClient();
        await client.sendEncryptedMessage(
          conversation.recipientId,
          conversationId,
          content
        );

        // Add message to local state (will be updated when server confirms)
        addMessage({
          id: `pending-${Date.now()}`,
          conversationId,
          senderId: user?.id || '',
          content,
          timestamp: Date.now(),
          status: 'sending',
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add the content to input on failure
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const recipientName = isGroupChat ? (group?.name || 'Group Chat') : (conversation?.name || 'Chat');
  const isOnline = isSelfChat || connectionStatus === 'connected';

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-zinc-800/50 px-6 py-4 bg-zinc-900/30 backdrop-blur-xl">
        <div className="relative">
          {isSelfChat ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 font-semibold text-black text-lg shadow-lg shadow-amber-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          ) : isGroupChat ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 font-semibold text-white text-lg shadow-lg shadow-purple-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 font-semibold text-white text-lg shadow-inner">
              {recipientName.charAt(0).toUpperCase()}
            </div>
          )}
          {!isSelfChat && !isGroupChat && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 ${
                isOnline ? 'bg-green-500' : 'bg-zinc-500'
              }`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-lg truncate">{recipientName}</h1>
          <p className="text-sm text-zinc-500">
            {isSelfChat
              ? 'Private notes, stored locally'
              : isGroupChat
                ? `${group?.memberCount || 0} members${group?.isPublic ? ' · Public' : ''}`
                : isOnline ? 'Online' : 'Connecting...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Group members button */}
          {isGroupChat && groupId && (
            <button
              onClick={() => setShowMembers(true)}
              className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all duration-200"
              title="View members"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v-1a6 6 0 00-6-6" />
              </svg>
            </button>
          )}
          {/* Encryption badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-green-400 font-medium">Encrypted</span>
          </div>
          <button className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all duration-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all duration-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-xs">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-6">
                <span className="text-4xl">👋</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {isSelfChat ? 'Your private notes' : `Say hello to ${recipientName}!`}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {isSelfChat
                  ? 'This is your personal space. Notes you write here are stored locally and never sent to anyone.'
                  : 'Messages are end-to-end encrypted. Only you and the recipient can read them.'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSelf={message.senderId === user?.id}
              conversationId={conversationId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {peerTyping && !isSelfChat && (
        <TypingIndicator conversationId={conversationId} userName={recipientName} isTyping={true} />
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-zinc-800/50 p-4 bg-zinc-900/30 backdrop-blur-xl">
        {/* Offline warning */}
        {!isSelfChat && !isOnline && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs text-yellow-400">Connecting to server... Messages will send when connected.</span>
          </div>
        )}

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
              className={`p-3.5 rounded-2xl transition-all duration-200 ${
                showEmojiPicker
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-900/50 border border-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
              title="Emoji picker (Ctrl+Shift+E)"
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
              placeholder={isSelfChat ? "Write a note..." : isOnline ? "Type a message... (: for emoji)" : "Waiting for connection..."}
              className="flex-1 px-5 py-3.5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isSelfChat && !isOnline}
            />

            <button
              type="submit"
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-105 active:scale-95 disabled:shadow-none disabled:scale-100"
              disabled={!input.trim() || isSending || (!isSelfChat && !isOnline)}
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

      {/* Group Members Modal */}
      {isGroupChat && groupId && group && (
        <GroupMembersModal
          isOpen={showMembers}
          onClose={() => setShowMembers(false)}
          groupId={groupId}
          groupName={group.name}
          ownerId={group.ownerId}
        />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isSelf,
  conversationId,
}: {
  message: Message;
  isSelf: boolean;
  conversationId: string;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const user = useAuthStore((state) => state.user);
  const addReaction = useChatStore((state) => state.addReaction);
  const removeReaction = useChatStore((state) => state.removeReaction);
  const isCode = message.content.includes('```');
  const timestamp = new Date(message.timestamp);

  const handleReaction = (messageId: string, emoji: string) => {
    // Check if user already reacted with this emoji
    const existingReaction = message.reactions?.find(
      r => r.userId === user?.id && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction
      removeReaction(messageId, user?.id || '', emoji);
      getWebSocketClient().removeReaction(messageId, conversationId, emoji);
    } else {
      // Add reaction
      addReaction(messageId, user?.id || '', emoji);
      getWebSocketClient().addReaction(messageId, conversationId, emoji);
    }
  };

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

  return (
    <div
      className={`flex ${isSelf ? 'justify-end' : 'justify-start'} group`}
      onMouseEnter={() => setShowReactions(true)}
      onMouseLeave={() => setShowReactions(false)}
    >
      <div className="relative">
        <div
          className={`max-w-[75%] rounded-3xl px-5 py-3 ${
            isSelf
              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-zinc-800/70 text-white shadow-lg'
          }`}
        >
          {isCode ? (
            <CodeContent content={message.content} isSelf={isSelf} />
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <p
              className={`text-xs ${isSelf ? 'text-amber-900/70' : 'text-zinc-500'}`}
            >
              {timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {isSelf && (
              <MessageStatus status={message.status} />
            )}
          </div>
        </div>

        {/* Display reactions */}
        {reactionGroups.length > 0 && (
          <div className={`flex gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
            {reactionGroups.map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(message.id, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                  userIds.includes(user?.id || '')
                    ? 'bg-amber-500/20 border border-amber-500/40'
                    : 'bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50'
                }`}
              >
                <span>{emoji}</span>
                {userIds.length > 1 && <span className="text-zinc-400">{userIds.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Reaction picker on hover */}
        {showReactions && (
          <div className={`absolute top-0 ${isSelf ? 'right-full mr-2' : 'left-full ml-2'}`}>
            <MessageReactionPicker
              messageId={message.id}
              onReact={handleReaction}
            />
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
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'delivered':
      return (
        <svg className="h-3.5 w-3.5 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
}

function CodeContent({ content, isSelf }: { content: string; isSelf: boolean }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            const [, lang, code] = match;
            return (
              <div key={i} className="overflow-x-auto rounded-2xl bg-zinc-900/80 p-4">
                {lang && (
                  <div className="mb-2 text-xs text-zinc-500 font-mono">{lang}</div>
                )}
                <pre className="font-mono text-sm text-green-400">
                  <code>{code.trim()}</code>
                </pre>
              </div>
            );
          }
        }
        return part ? (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {part}
          </p>
        ) : null;
      })}
    </div>
  );
}
