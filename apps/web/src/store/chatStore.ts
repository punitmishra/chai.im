import { create } from 'zustand';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface Conversation {
  id: string;
  name: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
}

interface ChatState {
  conversations: Map<string, Conversation>;
  messages: Map<string, Message[]>;
  activeConversationId: string | null;

  // Actions
  setActiveConversation: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
  markAsRead: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: new Map(),
  messages: new Map(),
  activeConversationId: null,

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().markAsRead(id);
    }
  },

  addConversation: (conversation) => {
    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.set(conversation.id, conversation);
      return { conversations: newConversations };
    });
  },

  addMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(message.conversationId) || [];
      newMessages.set(message.conversationId, [...existing, message]);

      // Update conversation's last message
      const newConversations = new Map(state.conversations);
      const conv = newConversations.get(message.conversationId);
      if (conv) {
        newConversations.set(message.conversationId, {
          ...conv,
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          unreadCount:
            state.activeConversationId === message.conversationId
              ? 0
              : conv.unreadCount + 1,
        });
      }

      return { messages: newMessages, conversations: newConversations };
    });
  },

  updateMessageStatus: (messageId, status) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      for (const [convId, msgs] of newMessages) {
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          const updated = [...msgs];
          updated[idx] = { ...updated[idx], status };
          newMessages.set(convId, updated);
          break;
        }
      }
      return { messages: newMessages };
    });
  },

  markAsRead: (conversationId) => {
    set((state) => {
      const newConversations = new Map(state.conversations);
      const conv = newConversations.get(conversationId);
      if (conv && conv.unreadCount > 0) {
        newConversations.set(conversationId, { ...conv, unreadCount: 0 });
        return { conversations: newConversations };
      }
      return state;
    });
  },
}));
