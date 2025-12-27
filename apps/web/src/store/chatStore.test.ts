import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, Message, Conversation } from './chatStore'

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useChatStore.setState({
      conversations: [],
      messages: [],
      activeConversationId: null,
    })
  })

  describe('addConversation', () => {
    it('should add a new conversation', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        name: 'Alice',
        recipientId: 'user-alice',
        participants: ['user-alice'],
        unreadCount: 0,
        hasSession: false,
      }

      useChatStore.getState().addConversation(conversation)

      const state = useChatStore.getState()
      expect(state.conversations).toHaveLength(1)
      expect(state.conversations[0]).toEqual(conversation)
    })

    it('should not add duplicate conversations', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        name: 'Alice',
        recipientId: 'user-alice',
        participants: ['user-alice'],
        unreadCount: 0,
        hasSession: false,
      }

      useChatStore.getState().addConversation(conversation)
      useChatStore.getState().addConversation(conversation)

      const state = useChatStore.getState()
      expect(state.conversations).toHaveLength(1)
    })
  })

  describe('addMessage', () => {
    it('should add a message and update conversation', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        name: 'Alice',
        recipientId: 'user-alice',
        participants: ['user-alice'],
        unreadCount: 0,
        hasSession: true,
      }
      useChatStore.getState().addConversation(conversation)

      const message: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        content: 'Hello!',
        timestamp: Date.now(),
        status: 'delivered',
      }

      useChatStore.getState().addMessage(message)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0]).toEqual(message)
      expect(state.conversations[0].lastMessage).toBe('Hello!')
      expect(state.conversations[0].unreadCount).toBe(1)
    })

    it('should not increment unread for active conversation', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        name: 'Alice',
        recipientId: 'user-alice',
        participants: ['user-alice'],
        unreadCount: 0,
        hasSession: true,
      }
      useChatStore.getState().addConversation(conversation)
      useChatStore.getState().setActiveConversation('conv-1')

      const message: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        content: 'Hello!',
        timestamp: Date.now(),
        status: 'delivered',
      }

      useChatStore.getState().addMessage(message)

      const state = useChatStore.getState()
      expect(state.conversations[0].unreadCount).toBe(0)
    })
  })

  describe('updateMessageStatus', () => {
    it('should update message status', () => {
      const message: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Hello!',
        timestamp: Date.now(),
        status: 'sending',
      }
      useChatStore.getState().addMessage(message)

      useChatStore.getState().updateMessageStatus('msg-1', 'sent')

      const state = useChatStore.getState()
      expect(state.messages[0].status).toBe('sent')
    })
  })

  describe('setSessionEstablished', () => {
    it('should mark session as established', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        name: 'Alice',
        recipientId: 'user-alice',
        participants: ['user-alice'],
        unreadCount: 0,
        hasSession: false,
      }
      useChatStore.getState().addConversation(conversation)

      useChatStore.getState().setSessionEstablished('conv-1')

      const state = useChatStore.getState()
      expect(state.conversations[0].hasSession).toBe(true)
    })
  })

  describe('markAsRead', () => {
    it('should reset unread count', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        name: 'Alice',
        recipientId: 'user-alice',
        participants: ['user-alice'],
        unreadCount: 5,
        hasSession: true,
      }
      useChatStore.getState().addConversation(conversation)

      useChatStore.getState().markAsRead('conv-1')

      const state = useChatStore.getState()
      expect(state.conversations[0].unreadCount).toBe(0)
    })
  })
})
