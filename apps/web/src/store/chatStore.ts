import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PERSISTED_MESSAGE_LIMIT } from '@/lib/config';

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  reactions?: Reaction[];
  attachments?: Attachment[];
  parentMessageId?: string; // For thread replies
  threadReplyCount?: number; // Count of replies to this message
}

export interface Conversation {
  id: string;
  name: string;
  recipientId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  hasSession: boolean;
}

interface ChatState {
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;

  // Thread state
  threads: Record<string, Message[]>; // Map of parentMessageId -> thread replies
  activeThreadId: string | null; // Currently open thread's parent message ID
  selectedMessageId: string | null; // Currently selected message for keyboard navigation

  // Actions
  setActiveConversation: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
  markAsRead: (conversationId: string) => void;
  setSessionEstablished: (conversationId: string) => void;
  addReaction: (messageId: string, userId: string, emoji: string) => void;
  removeReaction: (messageId: string, userId: string, emoji: string) => void;

  // Thread actions
  openThread: (parentMessageId: string) => void;
  closeThread: () => void;
  addThreadReply: (parentMessageId: string, reply: Message) => void;
  getThreadReplies: (parentMessageId: string) => Message[];

  // Message selection actions
  selectMessage: (messageId: string | null) => void;
  selectNextMessage: () => void;
  selectPreviousMessage: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: [],
      activeConversationId: null,

      // Thread state
      threads: {},
      activeThreadId: null,
      selectedMessageId: null,

      setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().markAsRead(id);
    }
  },

  addConversation: (conversation) => {
    set((state) => {
      // Don't add if already exists
      if (state.conversations.find((c) => c.id === conversation.id)) {
        return state;
      }
      return { conversations: [...state.conversations, conversation] };
    });
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  addMessage: (message) => {
    set((state) => {
      // Add message
      const messages = [...state.messages, message];

      // Update conversation's last message
      const conversations = state.conversations.map((conv) => {
        if (conv.id === message.conversationId) {
          return {
            ...conv,
            lastMessage: message.content,
            lastMessageTime: message.timestamp,
            unreadCount:
              state.activeConversationId === message.conversationId
                ? 0
                : conv.unreadCount + 1,
          };
        }
        return conv;
      });

      return { messages, conversations };
    });
  },

  updateMessageStatus: (messageId, status) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, status } : m
      ),
    }));
  },

  markAsRead: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },

  setSessionEstablished: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, hasSession: true } : c
      ),
    }));
  },

  addReaction: (messageId, userId, emoji) => {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions || [];
        // Don't add duplicate reaction
        if (reactions.some(r => r.userId === userId && r.emoji === emoji)) {
          return m;
        }
        return { ...m, reactions: [...reactions, { userId, emoji }] };
      }),
    }));
  },

  removeReaction: (messageId, userId, emoji) => {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions || [];
        return {
          ...m,
          reactions: reactions.filter(r => !(r.userId === userId && r.emoji === emoji)),
        };
      }),
    }));
  },

  // Thread actions
  openThread: (parentMessageId) => {
    set({ activeThreadId: parentMessageId });
  },

  closeThread: () => {
    set({ activeThreadId: null });
  },

  addThreadReply: (parentMessageId, reply) => {
    set((state) => {
      // Add reply to threads map
      const existingReplies = state.threads[parentMessageId] || [];
      const threads = {
        ...state.threads,
        [parentMessageId]: [...existingReplies, { ...reply, parentMessageId }],
      };

      // Update parent message's reply count
      const messages = state.messages.map((m) => {
        if (m.id === parentMessageId) {
          return {
            ...m,
            threadReplyCount: (m.threadReplyCount || 0) + 1,
          };
        }
        return m;
      });

      return { threads, messages };
    });
  },

  getThreadReplies: (parentMessageId) => {
    const state = get();
    return state.threads[parentMessageId] || [];
  },

  // Message selection actions
  selectMessage: (messageId) => {
    set({ selectedMessageId: messageId });
  },

  selectNextMessage: () => {
    const state = get();
    if (!state.activeConversationId) return;

    const conversationMessages = state.messages.filter(
      (m) => m.conversationId === state.activeConversationId && !m.parentMessageId
    );

    if (conversationMessages.length === 0) return;

    const currentIndex = state.selectedMessageId
      ? conversationMessages.findIndex((m) => m.id === state.selectedMessageId)
      : -1;

    const nextIndex = currentIndex < conversationMessages.length - 1 ? currentIndex + 1 : 0;
    set({ selectedMessageId: conversationMessages[nextIndex].id });
  },

  selectPreviousMessage: () => {
    const state = get();
    if (!state.activeConversationId) return;

    const conversationMessages = state.messages.filter(
      (m) => m.conversationId === state.activeConversationId && !m.parentMessageId
    );

    if (conversationMessages.length === 0) return;

    const currentIndex = state.selectedMessageId
      ? conversationMessages.findIndex((m) => m.id === state.selectedMessageId)
      : 0;

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : conversationMessages.length - 1;
    set({ selectedMessageId: conversationMessages[prevIndex].id });
  },
    }),
    {
      name: 'chai-chat',
      partialize: (state) => ({
        conversations: state.conversations,
        messages: state.messages.slice(-PERSISTED_MESSAGE_LIMIT),
        threads: state.threads,
      }),
    }
  )
);
