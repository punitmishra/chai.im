import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PERSISTED_MESSAGE_LIMIT } from '@/lib/config';

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  reactions?: Reaction[];
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
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: [],
      activeConversationId: null,

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
    }),
    {
      name: 'chai-chat',
      partialize: (state) => ({
        conversations: state.conversations,
        messages: state.messages.slice(-PERSISTED_MESSAGE_LIMIT),
      }),
    }
  )
);
