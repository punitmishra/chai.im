'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChatStore, Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useConnectionStore } from '@/store/connectionStore';
import { getWebSocketClient, connectIfAuthenticated } from '@/lib/ws/client';
import { EmojiPicker } from '@/components/EmojiPicker';
import { TypingIndicator } from '@/components/TypingIndicator';
import { MessageBubble, ThreadPanel } from '@/components/chat';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useEmojiAutocomplete, EmojiAutocompleteDropdown } from '@/hooks/useEmojiAutocomplete';
import { useMessageShortcuts } from '@/hooks/useMessageShortcuts';
import { uploadFile, formatFileSize } from '@/lib/api/attachments';
import { useGroupStore } from '@/store/groupStore';
import { GroupInfoPanel } from '@/components/group/GroupInfoPanel';

// Conversation ID prefixes
const SELF_CHAT_PREFIX = 'self_';
const GROUP_CHAT_PREFIX = 'group_';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [groupTypingUsers, setGroupTypingUsers] = useState<{ userId: string; username: string }[]>([]);
  const [showReactionPickerForMessage, setShowReactionPickerForMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get state from stores
  const user = useAuthStore((state) => state.user);
  const connectionStatus = useConnectionStore((state) => state.status);
  const allMessages = useChatStore((state) => state.messages);
  const conversations = useChatStore((state) => state.conversations);
  const addMessage = useChatStore((state) => state.addMessage);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const openThread = useChatStore((state) => state.openThread);
  const closeThread = useChatStore((state) => state.closeThread);
  const addThreadReply = useChatStore((state) => state.addThreadReply);
  const getThreadReplies = useChatStore((state) => state.getThreadReplies);
  const selectedMessageId = useChatStore((state) => state.selectedMessageId);
  const selectMessage = useChatStore((state) => state.selectMessage);

  // Group store
  const groupDetails = useGroupStore((state) => groupId ? state.getGroup(groupId) : undefined);
  const groupMembers = useGroupStore((state) => groupId ? state.getMembers(groupId) : []);
  const fetchGroupDetails = useGroupStore((state) => state.fetchGroupDetails);
  const fetchGroupMembers = useGroupStore((state) => state.fetchMembers);

  // Emoji autocomplete hook
  const emojiAutocomplete = useEmojiAutocomplete();

  // Keyboard shortcuts
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  // Message keyboard shortcuts
  const messageShortcuts = useMessageShortcuts({
    enabled: true,
    onOpenThread: (messageId) => openThread(messageId),
    onEditMessage: (messageId) => {
      // TODO: Implement edit mode
      console.log('Edit message:', messageId);
    },
    onAddReaction: (messageId) => {
      setShowReactionPickerForMessage(messageId);
    },
  });

  // Check conversation type
  const isSelfChat = conversationId.startsWith(SELF_CHAT_PREFIX);
  const isGroupChat = conversationId.startsWith(GROUP_CHAT_PREFIX);
  const groupId = isGroupChat ? conversationId.slice(GROUP_CHAT_PREFIX.length) : null;

  // Filter messages with useMemo to avoid infinite loop
  // Only show top-level messages (not thread replies)
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === conversationId && !m.parentMessageId),
    [allMessages, conversationId]
  );

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

  // Get parent message and thread replies for thread panel
  const parentMessage = useMemo(
    () => (activeThreadId ? allMessages.find((m) => m.id === activeThreadId) : null),
    [activeThreadId, allMessages]
  );

  const threadReplies = useMemo(
    () => (activeThreadId ? getThreadReplies(activeThreadId) : []),
    [activeThreadId, getThreadReplies]
  );

  // Connect to WebSocket on mount (only for non-self chats)
  useEffect(() => {
    if (!isSelfChat) {
      connectIfAuthenticated();

      // Join group if this is a group chat
      if (isGroupChat && groupId) {
        const client = getWebSocketClient();
        client.joinGroup(groupId);
        fetchGroupDetails(groupId).catch(() => {});
        fetchGroupMembers(groupId).catch(() => {});
      }
    }
  }, [isSelfChat, isGroupChat, groupId, fetchGroupDetails, fetchGroupMembers]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Request prekey bundle when starting a new conversation (only for non-self chats)
  useEffect(() => {
    if (conversation && !conversation.hasSession && !isSelfChat) {
      const client = getWebSocketClient();
      client.requestPrekeyBundle(conversation.recipientId);
    }
  }, [conversation, isSelfChat]);

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

    if (isGroupChat && groupId) {
      // Group typing indicators
      const unsubscribe = client.onGroupTyping((gId, userId, username, isTyping) => {
        if (gId === groupId && userId !== user?.id) {
          setGroupTypingUsers((prev) => {
            if (isTyping) {
              // Add user if not already in the list
              if (!prev.some((u) => u.userId === userId)) {
                return [...prev, { userId, username }];
              }
            } else {
              // Remove user
              return prev.filter((u) => u.userId !== userId);
            }
            return prev;
          });
        }
      });
      return unsubscribe;
    } else {
      // 1:1 typing indicators
      const unsubscribe = client.onTyping((userId, convId, isTyping) => {
        if (convId === conversationId && userId === conversation.recipientId) {
          setPeerTyping(isTyping);
        }
      });
      return unsubscribe;
    }
  }, [isSelfChat, isGroupChat, groupId, conversation, conversationId, user?.id]);

  // Handle typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    emojiAutocomplete.handleInputChange(e);

    // Send typing indicator (debounced)
    if (!isSelfChat && connectionStatus === 'connected') {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      const client = getWebSocketClient();

      if (isGroupChat && groupId) {
        // Group typing indicator
        client.sendGroupTypingStart(groupId);
        typingTimeoutRef.current = setTimeout(() => {
          client.sendGroupTypingStop(groupId);
        }, 2000);
      } else if (conversation) {
        // 1:1 typing indicator
        client.sendTypingStart(conversation.recipientId, conversationId);
        typingTimeoutRef.current = setTimeout(() => {
          if (conversation) {
            client.sendTypingStop(conversation.recipientId, conversationId);
          }
        }, 2000);
      }
    }
  }, [emojiAutocomplete, isSelfChat, isGroupChat, groupId, connectionStatus, conversation, conversationId]);

  // Handle emoji selection from picker
  const handleEmojiSelect = useCallback((emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

    // 25MB limit
    if (file.size > 25 * 1024 * 1024) {
      alert('File too large. Maximum size is 25 MB.');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadFile(file);

      // Add message with attachment
      addMessage({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conversationId,
        senderId: user?.id || '',
        content: '',
        timestamp: Date.now(),
        status: isSelfChat ? 'delivered' : 'sent',
        attachments: [{
          id: result.id,
          filename: result.filename,
          contentType: result.content_type,
          sizeBytes: result.size_bytes,
        }],
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [conversation, conversationId, user?.id, isSelfChat, addMessage]);

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
      } else if (isGroupChat && groupId) {
        // For group chats, send plaintext through WebSocket
        const client = getWebSocketClient();
        client.sendGroupMessage(groupId, content);

        // Add message to local state (will be updated when server echoes back)
        addMessage({
          id: `pending-group-${Date.now()}`,
          conversationId,
          senderId: user?.id || '',
          content,
          timestamp: Date.now(),
          status: 'sending',
        });
      } else {
        // For 1:1 chats, send encrypted through WebSocket
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

  // Handle sending thread reply
  const handleSendThreadReply = useCallback(
    async (content: string, parentMessageId: string) => {
      if (!conversation) return;

      const replyMessage: Message = {
        id: `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conversationId,
        senderId: user?.id || '',
        content,
        timestamp: Date.now(),
        status: isSelfChat ? 'delivered' : 'sending',
        parentMessageId,
      };

      // Add to thread replies
      addThreadReply(parentMessageId, replyMessage);

      // TODO: Send through WebSocket for non-self chats
      if (!isSelfChat) {
        // In a real implementation, you'd send this through the WebSocket
        console.log('Sending thread reply via WebSocket:', replyMessage);
      }
    },
    [conversation, conversationId, user?.id, isSelfChat, addThreadReply]
  );

  const recipientName = conversation?.name || 'Chat';
  const isOnline = isSelfChat || connectionStatus === 'connected';
  const showGroupTyping = isGroupChat && groupTypingUsers.length > 0;
  const groupTypingText = showGroupTyping
    ? groupTypingUsers.length === 1
      ? `${groupTypingUsers[0].username} is typing...`
      : groupTypingUsers.length === 2
        ? `${groupTypingUsers[0].username} and ${groupTypingUsers[1].username} are typing...`
        : `${groupTypingUsers[0].username} and ${groupTypingUsers.length - 1} others are typing...`
    : '';

  return (
    <div className="flex h-full flex-col bg-dark-950">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-dark-700/50 px-6 py-4 bg-dark-900/30 backdrop-blur-xl">
        <div className="relative">
          {isSelfChat ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 font-semibold text-black text-lg shadow-lg shadow-cyan-500/20">
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-dark-700 to-dark-800 font-semibold text-white text-lg shadow-inner">
              {recipientName.charAt(0).toUpperCase()}
            </div>
          )}
          {!isSelfChat && !isGroupChat && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-dark-900 ${
                isOnline ? 'bg-green-500' : 'bg-slate-500'
              }`}
            />
          )}
        </div>
        <div
          className={`flex-1 min-w-0 ${isGroupChat ? 'cursor-pointer' : ''}`}
          onClick={isGroupChat ? () => setShowGroupInfo(true) : undefined}
        >
          <h1 className="font-semibold text-white text-lg truncate">{recipientName}</h1>
          <p className="text-sm text-slate-500">
            {isSelfChat
              ? 'Private notes, stored locally'
              : isGroupChat
                ? `${groupMembers.length || groupDetails?.memberCount || 0} members`
                : isOnline
                  ? 'Online'
                  : 'Connecting...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Encryption badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-green-400 font-medium">Encrypted</span>
          </div>
          {/* Keyboard shortcuts hint */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-800/50 text-slate-500 text-xs">
            <span>J/K to navigate</span>
            <span className="text-slate-600">|</span>
            <span>T for thread</span>
          </div>
          <button className="p-2.5 rounded-xl hover:bg-dark-800/50 text-slate-400 hover:text-white transition-all duration-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="p-2.5 rounded-xl hover:bg-dark-800/50 text-slate-400 hover:text-white transition-all duration-200">
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
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 mb-6">
                <span className="text-4xl">👋</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {isSelfChat ? 'Your private notes' : `Say hello to ${recipientName}!`}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {isSelfChat
                  ? 'This is your personal space. Notes you write here are stored locally and never sent to anyone.'
                  : 'Messages are end-to-end encrypted. Only you and the recipient can read them.'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isSelf = message.senderId === user?.id;
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showSenderName = isGroupChat && !isSelf && (!prevMessage || prevMessage.senderId !== message.senderId);
            const senderName = message.senderName || groupMembers.find((m) => m.userId === message.senderId)?.username;

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isSelf={isSelf}
                conversationId={conversationId}
                onOpenThread={(messageId) => openThread(messageId)}
                showThreadIndicator={true}
                threadReplyCount={message.threadReplyCount || 0}
                isSelected={selectedMessageId === message.id}
                onSelect={(messageId) => selectMessage(messageId)}
                senderName={senderName}
                showSenderName={showSenderName}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {peerTyping && !isSelfChat && !isGroupChat && (
        <TypingIndicator conversationId={conversationId} userName={recipientName} isTyping={true} />
      )}
      {showGroupTyping && (
        <div className="px-6 py-2 text-sm text-slate-400 animate-pulse">
          {groupTypingText}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-dark-700/50 p-4 bg-dark-900/30 backdrop-blur-xl">
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
            {/* File upload button */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-3.5 rounded-2xl bg-dark-900/50 border border-dark-700/50 text-slate-400 hover:text-white hover:bg-dark-800/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Attach file"
            >
              {isUploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-dark-600 border-t-cyan-500" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>

            {/* Emoji picker button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-3.5 rounded-2xl transition-all duration-200 ${
                showEmojiPicker
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-dark-900/50 border border-dark-700/50 text-slate-400 hover:text-white hover:bg-dark-800/50'
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
              className="flex-1 px-5 py-3.5 bg-dark-900/50 border border-dark-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isSelfChat && !isOnline}
            />

            <button
              type="submit"
              className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:from-dark-800 disabled:to-dark-800 disabled:text-slate-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-105 active:scale-95 disabled:shadow-none disabled:scale-100"
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

      {/* Thread Panel */}
      {parentMessage && (
        <ThreadPanel
          parentMessage={parentMessage}
          threadReplies={threadReplies}
          conversationId={conversationId}
          isOpen={!!activeThreadId}
          onClose={closeThread}
          onSendReply={handleSendThreadReply}
        />
      )}

      {/* Group Info Panel */}
      {isGroupChat && groupId && (
        <GroupInfoPanel
          groupId={groupId}
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
        />
      )}
    </div>
  );
}
