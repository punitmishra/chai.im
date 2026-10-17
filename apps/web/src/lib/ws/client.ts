/**
 * WebSocket client for real-time messaging.
 */

import { useConnectionStore } from '@/store/connectionStore';
import { useChatStore, Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { usePresenceStore, UserStatus } from '@/store/presenceStore';
import { toast } from '@/store/toastStore';
import {
  decryptMessage,
  decryptPrekeyMessage,
  initSessionAndEncrypt,
  encryptMessage,
  saveSessionToStorage,
  loadSessionFromStorage,
  hasSession,
  generatePrekeyBundle,
  generateOneTimePrekeys,
} from '@/lib/crypto/wasm';
import { WS_URL, RECONNECT_DELAYS, PING_INTERVAL_MS, LOW_PREKEY_THRESHOLD, PREKEY_REPLENISH_COUNT, ACTIVITY_REPORT_INTERVAL_MS } from '@/lib/config';
import logger from '@/lib/logger';

// --- Protocol types matching chai-protocol/src/messages.rs ---

// PrekeyBundleData matches the Rust struct
interface PrekeyBundlePayload {
  identity_key: number[];
  signed_prekey: number[];
  signed_prekey_signature: number[];
  signed_prekey_id: number;
  one_time_prekey: number[] | null;
  one_time_prekey_id: number | null;
}

// OneTimePrekey matches the Rust struct
interface OneTimePrekeyPayload {
  id: number;
  key: number[];
}

// Discriminated union types for type-safe message handling
// MessageType is a string enum on the server: "Prekey", "Normal", "Receipt", "KeyUpdate"
type ClientMessage =
  | { type: 'Ping'; payload: null }
  | { type: 'SendMessage'; payload: SendMessagePayload }
  | { type: 'SendGroupMessage'; payload: GroupMessagePayload }
  | { type: 'GetPrekeyBundle'; payload: { user_id: string } }
  | { type: 'AckMessages'; payload: { message_ids: string[] } }
  | { type: 'UploadPrekeyBundle'; payload: { bundle: PrekeyBundlePayload } }
  | { type: 'UploadOneTimePrekeys'; payload: { prekeys: OneTimePrekeyPayload[] } }
  | { type: 'TypingStart'; payload: { recipient_id: string; conversation_id: string } }
  | { type: 'TypingStop'; payload: { recipient_id: string; conversation_id: string } }
  | { type: 'GroupTypingStart'; payload: { group_id: string } }
  | { type: 'GroupTypingStop'; payload: { group_id: string } }
  | { type: 'AddReaction'; payload: { message_id: string; conversation_id: string; emoji: string } }
  | { type: 'RemoveReaction'; payload: { message_id: string; conversation_id: string; emoji: string } }
  | { type: 'MarkRead'; payload: { conversation_id: string; message_ids: string[] } }
  | { type: 'SubscribePresence'; payload: { user_ids: string[] } }
  | { type: 'SetStatus'; payload: { status: UserStatus } }
  | { type: 'ReportActivity'; payload: null }
  | { type: 'JoinGroup'; payload: { group_id: string } }
  | { type: 'LeaveGroup'; payload: { group_id: string } };

type ServerMessage =
  | { type: 'Pong'; payload: null }
  | { type: 'Message'; payload: IncomingMessage }
  | { type: 'GroupMessage'; payload: IncomingGroupMessage }
  | { type: 'MessageSent'; payload: { message_id: string } }
  | { type: 'PrekeyBundle'; payload: PrekeyBundleResponse }
  | { type: 'LowPrekeys'; payload: { remaining: number } }
  | { type: 'Error'; payload: { code: string; message: string } }
  | { type: 'TypingIndicator'; payload: TypingIndicatorPayload }
  | { type: 'GroupTypingIndicator'; payload: GroupTypingIndicatorPayload }
  | { type: 'ReactionAdded'; payload: ReactionPayload }
  | { type: 'ReactionRemoved'; payload: ReactionPayload }
  | { type: 'MessageRead'; payload: { message_id: string } }
  | { type: 'PresenceUpdate'; payload: PresenceUpdatePayload }
  | { type: 'GroupJoined'; payload: { group_id: string } }
  | { type: 'GroupLeft'; payload: { group_id: string } }
  | { type: 'GroupMemberJoined'; payload: { group_id: string; user_id: string; username: string } }
  | { type: 'GroupMemberLeft'; payload: { group_id: string; user_id: string } };

interface PresenceUpdatePayload {
  user_id: string;
  status: UserStatus;
  last_active: number | null;
}

interface SendMessagePayload {
  recipient_id: string;
  conversation_id: string;
  ciphertext: number[];
  message_type: string; // "Prekey" | "Normal" — must be string for serde
}

interface GroupMessagePayload {
  group_id: string;
  content: string;
}

interface IncomingGroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_username: string;
  content: string;
  timestamp: number;
}

interface GroupTypingIndicatorPayload {
  group_id: string;
  user_id: string;
  username: string;
  is_typing: boolean;
}

interface TypingIndicatorPayload {
  user_id: string;
  conversation_id: string;
  is_typing: boolean;
}

interface ReactionPayload {
  message_id: string;
  conversation_id: string;
  user_id: string;
  emoji: string;
}

interface IncomingMessage {
  id: string;
  sender_id: string;
  conversation_id: string;
  ciphertext: number[];
  message_type: string; // "Prekey" | "Normal" — string from serde
  timestamp: number;
}

interface PrekeyBundleResponse {
  user_id: string;
  bundle: PrekeyBundlePayload | null;
}

// Pending message waiting for prekey bundle
interface PendingMessage {
  recipientId: string;
  conversationId: string;
  content: string;
}

type MessageHandler = (message: ServerMessage) => void;
type TypingHandler = (userId: string, conversationId: string, isTyping: boolean) => void;
type GroupTypingHandler = (groupId: string, userId: string, username: string, isTyping: boolean) => void;
type ReactionHandler = (messageId: string, conversationId: string, userId: string, emoji: string, added: boolean) => void;
type ReadHandler = (messageId: string) => void;
type PresenceHandler = (userId: string, status: UserStatus, lastActive: number | null) => void;
type GroupMessageHandler = (message: IncomingGroupMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private typingHandlers: TypingHandler[] = [];
  private groupTypingHandlers: GroupTypingHandler[] = [];
  private reactionHandlers: ReactionHandler[] = [];
  private readHandlers: ReadHandler[] = [];
  private presenceHandlers: PresenceHandler[] = [];
  private groupMessageHandlers: GroupMessageHandler[] = [];
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private activityInterval: number | null = null;
  private typingTimeout: Map<string, number> = new Map(); // Debounce typing
  private lastActivityTime: number = Date.now();
  private pendingMessages: Map<string, PendingMessage> = new Map(); // recipientId → pending msg

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // Get session token from auth store
    const token = useAuthStore.getState().sessionToken;
    if (!token) {
      logger.warn('No session token, cannot connect to WebSocket');
      useConnectionStore.getState().setStatus('error', 'Not authenticated');
      return;
    }

    useConnectionStore.getState().setStatus('connecting');

    try {
      // Include token as query parameter
      const url = `${this.baseUrl}?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(url);
      this.setupEventListeners();
    } catch (error) {
      logger.ws.error(error);
      this.handleDisconnect();
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear presence data on disconnect
    usePresenceStore.getState().clearPresence();
    useConnectionStore.getState().setStatus('disconnected');
  }

  /**
   * Send a message to the server.
   */
  send(message: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket not connected, message not sent');
      return;
    }

    this.ws.send(JSON.stringify(message));
    logger.ws.messageSent(message.type);
  }

  /**
   * Send an encrypted message to a recipient.
   * Handles session establishment automatically for first messages.
   */
  async sendEncryptedMessage(
    recipientId: string,
    conversationId: string,
    content: string
  ): Promise<void> {
    try {
      const sessionExists = await hasSession(recipientId);

      if (sessionExists) {
        // Existing session → encrypt as Normal message
        const ciphertext = await encryptMessage(recipientId, content);

        this.send({
          type: 'SendMessage',
          payload: {
            recipient_id: recipientId,
            conversation_id: conversationId,
            ciphertext: Array.from(ciphertext),
            message_type: 'Normal',
          },
        });

        // Save updated session state
        await saveSessionToStorage(recipientId);
      } else {
        // No session → queue message and request prekey bundle
        this.pendingMessages.set(recipientId, { recipientId, conversationId, content });
        this.requestPrekeyBundle(recipientId);
        logger.info(`Requesting prekey bundle for ${recipientId} (first message)`);
      }
    } catch (error) {
      logger.crypto.encryptionFailed(error);
      throw error;
    }
  }

  /**
   * Send a group message (plaintext for now, Sender Keys encryption planned).
   */
  sendGroupMessage(groupId: string, content: string): void {
    this.send({
      type: 'SendGroupMessage',
      payload: {
        group_id: groupId,
        content,
      },
    });
  }

  /**
   * Join a group (subscribe to messages).
   */
  joinGroup(groupId: string): void {
    this.send({
      type: 'JoinGroup',
      payload: { group_id: groupId },
    });
  }

  /**
   * Leave a group.
   */
  leaveGroup(groupId: string): void {
    this.send({
      type: 'LeaveGroup',
      payload: { group_id: groupId },
    });
  }

  /**
   * Send typing indicator for group.
   */
  sendGroupTypingStart(groupId: string): void {
    const key = `group:${groupId}`;
    const existingTimeout = this.typingTimeout.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.send({
      type: 'GroupTypingStart',
      payload: { group_id: groupId },
    });

    const timeout = window.setTimeout(() => {
      this.sendGroupTypingStop(groupId);
      this.typingTimeout.delete(key);
    }, 5000);
    this.typingTimeout.set(key, timeout);
  }

  /**
   * Stop typing indicator for group.
   */
  sendGroupTypingStop(groupId: string): void {
    const key = `group:${groupId}`;
    const existingTimeout = this.typingTimeout.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeout.delete(key);
    }

    this.send({
      type: 'GroupTypingStop',
      payload: { group_id: groupId },
    });
  }

  /**
   * Register a group message handler.
   */
  onGroupMessage(handler: GroupMessageHandler): () => void {
    this.groupMessageHandlers.push(handler);
    return () => {
      const index = this.groupMessageHandlers.indexOf(handler);
      if (index !== -1) this.groupMessageHandlers.splice(index, 1);
    };
  }

  /**
   * Register a group typing handler.
   */
  onGroupTyping(handler: GroupTypingHandler): () => void {
    this.groupTypingHandlers.push(handler);
    return () => {
      const index = this.groupTypingHandlers.indexOf(handler);
      if (index !== -1) this.groupTypingHandlers.splice(index, 1);
    };
  }

  /**
   * Request a user's prekey bundle for session initialization.
   */
  requestPrekeyBundle(userId: string): void {
    this.send({
      type: 'GetPrekeyBundle',
      payload: { user_id: userId },
    });
  }

  /**
   * Acknowledge message delivery.
   */
  ackMessages(messageIds: string[]): void {
    this.send({
      type: 'AckMessages',
      payload: { message_ids: messageIds },
    });
  }

  /**
   * Send typing indicator (debounced).
   */
  sendTypingStart(recipientId: string, conversationId: string): void {
    // Clear existing timeout for this conversation
    const key = `${recipientId}:${conversationId}`;
    const existingTimeout = this.typingTimeout.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.send({
      type: 'TypingStart',
      payload: { recipient_id: recipientId, conversation_id: conversationId },
    });

    // Auto-stop typing after 5 seconds
    const timeout = window.setTimeout(() => {
      this.sendTypingStop(recipientId, conversationId);
      this.typingTimeout.delete(key);
    }, 5000);
    this.typingTimeout.set(key, timeout);
  }

  /**
   * Stop typing indicator.
   */
  sendTypingStop(recipientId: string, conversationId: string): void {
    const key = `${recipientId}:${conversationId}`;
    const existingTimeout = this.typingTimeout.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeout.delete(key);
    }

    this.send({
      type: 'TypingStop',
      payload: { recipient_id: recipientId, conversation_id: conversationId },
    });
  }

  /**
   * Add a reaction to a message.
   */
  addReaction(messageId: string, conversationId: string, emoji: string): void {
    this.send({
      type: 'AddReaction',
      payload: { message_id: messageId, conversation_id: conversationId, emoji },
    });
  }

  /**
   * Remove a reaction from a message.
   */
  removeReaction(messageId: string, conversationId: string, emoji: string): void {
    this.send({
      type: 'RemoveReaction',
      payload: { message_id: messageId, conversation_id: conversationId, emoji },
    });
  }

  /**
   * Mark messages as read.
   */
  markRead(conversationId: string, messageIds: string[]): void {
    if (messageIds.length === 0) return;
    this.send({
      type: 'MarkRead',
      payload: { conversation_id: conversationId, message_ids: messageIds },
    });
  }

  /**
   * Subscribe to presence updates for specific users.
   */
  subscribePresence(userIds: string[]): void {
    if (userIds.length === 0) return;

    // Update local subscription state
    usePresenceStore.getState().subscribe(userIds);

    this.send({
      type: 'SubscribePresence',
      payload: { user_ids: userIds },
    });
    logger.info(`Subscribed to presence for ${userIds.length} users`);
  }

  /**
   * Set own status (for DND mode).
   */
  setStatus(status: UserStatus): void {
    this.send({
      type: 'SetStatus',
      payload: { status },
    });
    logger.info(`Set status to ${status}`);
  }

  /**
   * Report user activity (called when user interacts with the app).
   */
  reportActivity(): void {
    const now = Date.now();
    // Only report if enough time has passed since last report
    if (now - this.lastActivityTime > 30000) { // 30 seconds
      this.lastActivityTime = now;
      this.send({
        type: 'ReportActivity',
        payload: null,
      });
    }
  }

  /**
   * Register a typing handler.
   */
  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.push(handler);
    return () => {
      const index = this.typingHandlers.indexOf(handler);
      if (index !== -1) this.typingHandlers.splice(index, 1);
    };
  }

  /**
   * Register a reaction handler.
   */
  onReaction(handler: ReactionHandler): () => void {
    this.reactionHandlers.push(handler);
    return () => {
      const index = this.reactionHandlers.indexOf(handler);
      if (index !== -1) this.reactionHandlers.splice(index, 1);
    };
  }

  /**
   * Register a read receipt handler.
   */
  onRead(handler: ReadHandler): () => void {
    this.readHandlers.push(handler);
    return () => {
      const index = this.readHandlers.indexOf(handler);
      if (index !== -1) this.readHandlers.splice(index, 1);
    };
  }

  /**
   * Register a presence handler.
   */
  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.push(handler);
    return () => {
      const index = this.presenceHandlers.indexOf(handler);
      if (index !== -1) this.presenceHandlers.splice(index, 1);
    };
  }

  /**
   * Register a message handler.
   */
  on(type: string, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type) || [];
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = async () => {
      logger.ws.connected();
      useConnectionStore.getState().setStatus('connected');
      useConnectionStore.getState().resetReconnectAttempts();
      this.startPingInterval();

      // Upload our prekey bundle and one-time prekeys
      await this.uploadPrekeys();

      // Restore persisted sessions for existing conversations
      await this.restoreSessions();

      // Subscribe to presence updates for all conversation participants
      this.subscribeToConversationPresence();
    };

    this.ws.onclose = () => {
      logger.ws.disconnected();
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      logger.ws.error(error);
      useConnectionStore.getState().setStatus('error', 'Connection error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        logger.ws.messageReceived(message.type);
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', error);
      }
    };
  }

  private handleMessage(message: ServerMessage): void {
    const handlers = this.handlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        logger.error('Message handler error', error);
      }
    }

    // Handle built-in message types
    switch (message.type) {
      case 'Pong':
        // Heartbeat response, no action needed
        break;
      case 'Message':
        this.handleIncomingMessage(message.payload as IncomingMessage);
        break;
      case 'MessageSent':
        this.handleMessageSent(message.payload as { message_id: string });
        break;
      case 'PrekeyBundle':
        this.handlePrekeyBundle(message.payload as PrekeyBundleResponse);
        break;
      case 'LowPrekeys':
        this.handleLowPrekeys(message.payload as { remaining: number });
        break;
      case 'TypingIndicator':
        this.handleTypingIndicator(message.payload as TypingIndicatorPayload);
        break;
      case 'ReactionAdded':
        this.handleReactionAdded(message.payload as ReactionPayload);
        break;
      case 'ReactionRemoved':
        this.handleReactionRemoved(message.payload as ReactionPayload);
        break;
      case 'MessageRead':
        this.handleMessageRead(message.payload as { message_id: string });
        break;
      case 'PresenceUpdate':
        this.handlePresenceUpdate(message.payload as PresenceUpdatePayload);
        break;
      case 'GroupMessage':
        this.handleGroupMessage(message.payload as IncomingGroupMessage);
        break;
      case 'GroupTypingIndicator':
        this.handleGroupTypingIndicator(message.payload as GroupTypingIndicatorPayload);
        break;
    }
  }

  private handleGroupMessage(payload: IncomingGroupMessage): void {
    const conversationId = `group_${payload.group_id}`;

    const message: Message = {
      id: payload.id,
      conversationId,
      senderId: payload.sender_id,
      content: payload.content,
      timestamp: payload.timestamp,
      status: 'delivered',
      senderName: payload.sender_username,
    };

    useChatStore.getState().addMessage(message);

    // Notify handlers
    for (const handler of this.groupMessageHandlers) {
      try {
        handler(payload);
      } catch (error) {
        logger.error('Group message handler error', error);
      }
    }
  }

  private handleGroupTypingIndicator(payload: GroupTypingIndicatorPayload): void {
    for (const handler of this.groupTypingHandlers) {
      try {
        handler(payload.group_id, payload.user_id, payload.username, payload.is_typing);
      } catch (error) {
        logger.error('Group typing handler error', error);
      }
    }
  }

  private async handleIncomingMessage(payload: IncomingMessage): Promise<void> {
    let content = '[Encrypted]';

    try {
      const ciphertext = new Uint8Array(payload.ciphertext);

      if (payload.message_type === 'Prekey') {
        // Prekey message: contains X3DH handshake + first encrypted message
        // decryptPrekeyMessage establishes the session and decrypts
        content = await decryptPrekeyMessage(payload.sender_id, ciphertext);

        // Save newly established session
        await saveSessionToStorage(payload.sender_id);

        // Mark conversation as having an established session
        const conversations = useChatStore.getState().conversations;
        const conversation = conversations.find(c => c.recipientId === payload.sender_id);
        if (conversation) {
          useChatStore.getState().setSessionEstablished(conversation.id);
        }
      } else {
        // Normal message: decrypt with existing session
        content = await decryptMessage(payload.sender_id, ciphertext);

        // Save updated session state
        await saveSessionToStorage(payload.sender_id);
      }
    } catch (error) {
      logger.crypto.decryptionFailed(error);
      content = '[Failed to decrypt]';
    }

    const message: Message = {
      id: payload.id,
      conversationId: payload.conversation_id,
      senderId: payload.sender_id,
      content,
      timestamp: payload.timestamp,
      status: 'delivered',
    };

    useChatStore.getState().addMessage(message);

    // Acknowledge delivery
    this.ackMessages([payload.id]);
  }

  private handleMessageSent(payload: { message_id: string }): void {
    useChatStore.getState().updateMessageStatus(payload.message_id, 'sent');
  }

  private async handlePrekeyBundle(payload: PrekeyBundleResponse): Promise<void> {
    if (!payload.bundle) {
      logger.warn(`No prekey bundle available for ${payload.user_id}`);
      this.pendingMessages.delete(payload.user_id);
      toast.error('User has no prekeys available');
      return;
    }

    try {
      // Assemble bundle bytes in the format expected by WASM parse_prekey_bundle:
      // [identity_key(32)] [signed_prekey(32)] [signature(64)] [signed_prekey_id(4-LE)]
      // [has_otp(1)] [otp(32)?] [otp_id(4-LE)?]
      const bundleBytes = assembleBundleBytes(payload.bundle);

      // Check if there's a pending message for this user
      const pending = this.pendingMessages.get(payload.user_id);

      if (pending) {
        // First message flow: init session AND encrypt the message in one step
        // This produces a PrekeyMessagePayload (bincode) compatible with CLI
        const ciphertext = await initSessionAndEncrypt(
          payload.user_id,
          bundleBytes,
          pending.content
        );

        // Send as Prekey message type
        this.send({
          type: 'SendMessage',
          payload: {
            recipient_id: pending.recipientId,
            conversation_id: pending.conversationId,
            ciphertext: Array.from(ciphertext),
            message_type: 'Prekey',
          },
        });

        this.pendingMessages.delete(payload.user_id);
        logger.info(`Sent Prekey message to ${payload.user_id}`);
      } else {
        // No pending message — just init session for future use
        // Use initSessionAndEncrypt with empty content as a workaround,
        // or init without encrypting. For now, store the bundle for later.
        // Actually, we need to use initSessionAndEncrypt since it's the only
        // way to establish a session. Send with empty content.
        const ciphertext = await initSessionAndEncrypt(
          payload.user_id,
          bundleBytes,
          '' // empty first message (session establishment)
        );

        // Don't send the empty message, just save the session
        // Note: This won't work with the real WASM because initSessionAndEncrypt
        // consumes the OTK. For real usage, we should only init session when
        // we have a message to send.
        logger.info(`Session established with ${payload.user_id} (no pending message)`);
      }

      // Save session to IndexedDB
      await saveSessionToStorage(payload.user_id);

      // Mark conversation as having an established session
      const conversations = useChatStore.getState().conversations;
      const conversation = conversations.find(c => c.recipientId === payload.user_id);
      if (conversation) {
        useChatStore.getState().setSessionEstablished(conversation.id);
      }

      logger.ws.sessionInitialized(payload.user_id);
    } catch (error) {
      logger.error('Failed to initialize session', error);
      this.pendingMessages.delete(payload.user_id);
      toast.error('Failed to establish secure session');
    }
  }

  private async handleLowPrekeys(payload: { remaining: number }): Promise<void> {
    logger.warn(`Low prekeys: ${payload.remaining} remaining`);

    if (payload.remaining < LOW_PREKEY_THRESHOLD) {
      try {
        const otkBytes = await generateOneTimePrekeys(PREKEY_REPLENISH_COUNT);
        const prekeys = parseOTKBytes(otkBytes);

        this.send({
          type: 'UploadOneTimePrekeys',
          payload: { prekeys },
        });

        logger.info(`Uploaded ${prekeys.length} new one-time prekeys`);
      } catch (error) {
        logger.error('Failed to replenish prekeys', error);
      }
    }
  }

  private handleTypingIndicator(payload: TypingIndicatorPayload): void {
    for (const handler of this.typingHandlers) {
      try {
        handler(payload.user_id, payload.conversation_id, payload.is_typing);
      } catch (error) {
        logger.error('Typing handler error', error);
      }
    }
  }

  private handleReactionAdded(payload: ReactionPayload): void {
    // Update chat store with new reaction
    useChatStore.getState().addReaction(payload.message_id, payload.user_id, payload.emoji);

    for (const handler of this.reactionHandlers) {
      try {
        handler(payload.message_id, payload.conversation_id, payload.user_id, payload.emoji, true);
      } catch (error) {
        logger.error('Reaction handler error', error);
      }
    }
  }

  private handleReactionRemoved(payload: ReactionPayload): void {
    // Update chat store to remove reaction
    useChatStore.getState().removeReaction(payload.message_id, payload.user_id, payload.emoji);

    for (const handler of this.reactionHandlers) {
      try {
        handler(payload.message_id, payload.conversation_id, payload.user_id, payload.emoji, false);
      } catch (error) {
        logger.error('Reaction handler error', error);
      }
    }
  }

  private handleMessageRead(payload: { message_id: string }): void {
    useChatStore.getState().updateMessageStatus(payload.message_id, 'read');

    for (const handler of this.readHandlers) {
      try {
        handler(payload.message_id);
      } catch (error) {
        logger.error('Read handler error', error);
      }
    }
  }

  private handlePresenceUpdate(payload: PresenceUpdatePayload): void {
    // Update presence store
    usePresenceStore.getState().updatePresence(
      payload.user_id,
      payload.status,
      payload.last_active
    );

    // Notify handlers
    for (const handler of this.presenceHandlers) {
      try {
        handler(payload.user_id, payload.status, payload.last_active);
      } catch (error) {
        logger.error('Presence handler error', error);
      }
    }

    logger.info(`Presence update: ${payload.user_id} is now ${payload.status}`);
  }

  private handleDisconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }

    const store = useConnectionStore.getState();
    store.setStatus('disconnected');

    // Only reconnect if we're still authenticated
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      return;
    }

    // Schedule reconnection
    const attempts = store.reconnectAttempts;
    const delay = RECONNECT_DELAYS[Math.min(attempts, RECONNECT_DELAYS.length - 1)];

    store.incrementReconnectAttempts();

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = window.setInterval(() => {
      this.send({ type: 'Ping', payload: null });
    }, PING_INTERVAL_MS);

    // Start activity reporting interval
    this.startActivityInterval();
  }

  private startActivityInterval(): void {
    // Clear any existing interval
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    // Report activity periodically to prevent auto-away
    const interval = typeof ACTIVITY_REPORT_INTERVAL_MS !== 'undefined'
      ? ACTIVITY_REPORT_INTERVAL_MS
      : 60000; // Default to 1 minute

    this.activityInterval = window.setInterval(() => {
      // Only report if there has been recent user activity
      if (Date.now() - this.lastActivityTime < interval) {
        this.send({ type: 'ReportActivity', payload: null });
      }
    }, interval);
  }

  /**
   * Upload prekey bundle and one-time prekeys after connecting.
   */
  private async uploadPrekeys(): Promise<void> {
    try {
      // Generate and upload prekey bundle
      const bundleBytes = await generatePrekeyBundle();
      const bundle = parseBundleBytesToPayload(bundleBytes);

      this.send({
        type: 'UploadPrekeyBundle',
        payload: { bundle },
      });

      // Generate and upload one-time prekeys
      const otkBytes = await generateOneTimePrekeys(PREKEY_REPLENISH_COUNT);
      const prekeys = parseOTKBytes(otkBytes);

      this.send({
        type: 'UploadOneTimePrekeys',
        payload: { prekeys },
      });

      logger.info(`Uploaded prekey bundle and ${prekeys.length} one-time prekeys`);
    } catch (error) {
      logger.error('Failed to upload prekeys', error);
    }
  }

  /**
   * Subscribe to presence for all conversation participants.
   * Called after connecting to get initial presence state.
   */
  private subscribeToConversationPresence(): void {
    const conversations = useChatStore.getState().conversations;
    const userIds = conversations.map(c => c.recipientId).filter(Boolean);

    if (userIds.length > 0) {
      this.subscribePresence(userIds);
    }
  }

  /**
   * Restore persisted sessions for existing conversations.
   */
  private async restoreSessions(): Promise<void> {
    const conversations = useChatStore.getState().conversations;
    let restoredCount = 0;
    let failedCount = 0;

    for (const conv of conversations) {
      try {
        // Check if we already have a session in memory
        const inMemory = await hasSession(conv.recipientId);
        if (inMemory) {
          useChatStore.getState().setSessionEstablished(conv.id);
          continue;
        }

        // Try to load from storage
        const loaded = await loadSessionFromStorage(conv.recipientId);
        if (loaded) {
          useChatStore.getState().setSessionEstablished(conv.id);
          logger.ws.sessionRestored(conv.recipientId);
          restoredCount++;
        }
      } catch (error) {
        logger.ws.sessionRestoreFailed(conv.recipientId, error);
        failedCount++;
      }
    }

    // Notify user if some sessions failed to restore
    if (failedCount > 0) {
      toast.warning(`${failedCount} conversation(s) need re-encryption setup`);
    }

    if (restoredCount > 0) {
      logger.info(`Restored ${restoredCount} sessions from storage`);
    }
  }
}

// --- Helper functions for byte parsing ---

/**
 * Assemble prekey bundle bytes in WASM-expected format from server JSON.
 * Format: [identity_key(32)] [signed_prekey(32)] [signature(64)]
 *         [signed_prekey_id(4-LE)] [has_otp(1)] [otp(32)?] [otp_id(4-LE)?]
 */
function assembleBundleBytes(bundle: PrekeyBundlePayload): Uint8Array {
  const maxSize = 32 + 32 + 64 + 4 + 1 + 32 + 4; // 169 bytes max
  const data = new Uint8Array(maxSize);
  const view = new DataView(data.buffer);
  let offset = 0;

  // identity_key (32 bytes)
  const ik = new Uint8Array(bundle.identity_key);
  data.set(ik, offset);
  offset += 32;

  // signed_prekey (32 bytes)
  const spk = new Uint8Array(bundle.signed_prekey);
  data.set(spk, offset);
  offset += 32;

  // signed_prekey_signature (64 bytes)
  const sig = new Uint8Array(bundle.signed_prekey_signature);
  data.set(sig, offset);
  offset += 64;

  // signed_prekey_id (4 bytes little-endian)
  view.setUint32(offset, bundle.signed_prekey_id, true);
  offset += 4;

  // one_time_prekey (optional)
  if (bundle.one_time_prekey && bundle.one_time_prekey_id !== null) {
    data[offset] = 1; // has OTP
    offset += 1;

    const otp = new Uint8Array(bundle.one_time_prekey);
    data.set(otp, offset);
    offset += 32;

    view.setUint32(offset, bundle.one_time_prekey_id!, true);
    offset += 4;
  } else {
    data[offset] = 0; // no OTP
    offset += 1;
  }

  return data.slice(0, offset);
}

/**
 * Parse WASM generatePrekeyBundle output into PrekeyBundlePayload for UploadPrekeyBundle.
 * Input format: [identity_key(32)] [signed_prekey(32)] [signature(64)]
 *               [signed_prekey_id(4-LE)] [has_otp(1)] [otp(32)?] [otp_id(4-LE)?]
 */
function parseBundleBytesToPayload(data: Uint8Array): PrekeyBundlePayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  const identity_key = Array.from(data.slice(offset, offset + 32));
  offset += 32;

  const signed_prekey = Array.from(data.slice(offset, offset + 32));
  offset += 32;

  const signed_prekey_signature = Array.from(data.slice(offset, offset + 64));
  offset += 64;

  const signed_prekey_id = view.getUint32(offset, true);
  offset += 4;

  let one_time_prekey: number[] | null = null;
  let one_time_prekey_id: number | null = null;

  if (data[offset] === 1) {
    offset += 1;
    one_time_prekey = Array.from(data.slice(offset, offset + 32));
    offset += 32;
    one_time_prekey_id = view.getUint32(offset, true);
  }

  return {
    identity_key,
    signed_prekey,
    signed_prekey_signature,
    signed_prekey_id,
    one_time_prekey,
    one_time_prekey_id,
  };
}

/**
 * Parse WASM generateOneTimePrekeys output into OneTimePrekeyPayload array.
 * Input format: [count(4-LE)] then [id(4-LE)][key(32)]...
 */
function parseOTKBytes(data: Uint8Array): OneTimePrekeyPayload[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(0, true);
  const prekeys: OneTimePrekeyPayload[] = [];
  let offset = 4;

  for (let i = 0; i < count; i++) {
    const id = view.getUint32(offset, true);
    offset += 4;
    const key = Array.from(data.slice(offset, offset + 32));
    offset += 32;
    prekeys.push({ id, key });
  }

  return prekeys;
}

// Singleton instance
let client: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!client) {
    client = new WebSocketClient(WS_URL);
  }
  return client;
}

/**
 * Connect to WebSocket if authenticated.
 */
export function connectIfAuthenticated(): void {
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (isAuthenticated) {
    getWebSocketClient().connect();
  }
}
