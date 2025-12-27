/**
 * WebSocket client for real-time messaging.
 */

import { useConnectionStore } from '@/store/connectionStore';
import { useChatStore, Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { decryptMessage, initSession, saveSessionToStorage, loadSessionFromStorage, hasSession, generateOneTimePrekeys } from '@/lib/crypto/wasm';
import { WS_URL, RECONNECT_DELAYS, PING_INTERVAL_MS, LOW_PREKEY_THRESHOLD, PREKEY_REPLENISH_COUNT } from '@/lib/config';
import logger from '@/lib/logger';

// Discriminated union types for type-safe message handling
type ClientMessage =
  | { type: 'Ping'; payload: null }
  | { type: 'SendMessage'; payload: SendMessagePayload }
  | { type: 'GetPrekeyBundle'; payload: { user_id: string } }
  | { type: 'AckMessages'; payload: { message_ids: string[] } }
  | { type: 'UploadPrekeys'; payload: { prekeys: number[][] } };

type ServerMessage =
  | { type: 'Pong'; payload: null }
  | { type: 'Message'; payload: IncomingMessage }
  | { type: 'MessageSent'; payload: { message_id: string } }
  | { type: 'PrekeyBundle'; payload: PrekeyBundleResponse }
  | { type: 'LowPrekeys'; payload: { remaining: number } }
  | { type: 'Error'; payload: { code: string; message: string } };

interface SendMessagePayload {
  recipient_id: string;
  conversation_id: string;
  ciphertext: number[];
  message_type: number;
}

type MessageHandler = (message: ServerMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;

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

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

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
   */
  async sendEncryptedMessage(
    recipientId: string,
    conversationId: string,
    content: string
  ): Promise<void> {
    // Import encryption from wasm
    const { encryptMessage } = await import('@/lib/crypto/wasm');

    try {
      const ciphertext = await encryptMessage(recipientId, content);

      this.send({
        type: 'SendMessage',
        payload: {
          recipient_id: recipientId,
          conversation_id: conversationId,
          ciphertext: Array.from(ciphertext),
          message_type: 2, // Normal message
        },
      });
    } catch (error) {
      logger.crypto.encryptionFailed(error);
      throw error;
    }
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

      // Restore persisted sessions for existing conversations
      await this.restoreSessions();
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
    }
  }

  private async handleIncomingMessage(payload: IncomingMessage): Promise<void> {
    let content = '[Encrypted]';

    try {
      // Decrypt message using WASM crypto
      const ciphertext = new Uint8Array(payload.ciphertext);
      content = await decryptMessage(payload.sender_id, ciphertext);
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
    if (payload.bundle) {
      try {
        // Initialize session with the received bundle
        const bundleBytes = new Uint8Array([
          ...payload.bundle.identity_key,
          ...payload.bundle.signed_prekey,
          ...payload.bundle.signed_prekey_signature,
          ...(payload.bundle.one_time_prekey || []),
        ]);
        await initSession(payload.user_id, bundleBytes);
        logger.ws.sessionInitialized(payload.user_id);

        // Save session to IndexedDB for persistence
        await saveSessionToStorage(payload.user_id);

        // Mark conversation as having an established session
        const conversations = useChatStore.getState().conversations;
        const conversation = conversations.find(c => c.recipientId === payload.user_id);
        if (conversation) {
          useChatStore.getState().setSessionEstablished(conversation.id);
        }
      } catch (error) {
        logger.error('Failed to initialize session', error);
        toast.error('Failed to establish secure session');
      }
    }
  }

  private async handleLowPrekeys(payload: { remaining: number }): Promise<void> {
    logger.warn(`Low prekeys: ${payload.remaining} remaining`);

    // Replenish prekeys if below threshold
    if (payload.remaining < LOW_PREKEY_THRESHOLD) {
      try {
        const newPrekeys = await generateOneTimePrekeys(PREKEY_REPLENISH_COUNT);

        // Convert to array of arrays for the server
        const prekeyArrays: number[][] = [];
        const PREKEY_SIZE = 32; // X25519 public key size
        for (let i = 0; i < newPrekeys.length; i += PREKEY_SIZE) {
          prekeyArrays.push(Array.from(newPrekeys.slice(i, i + PREKEY_SIZE)));
        }

        this.send({
          type: 'UploadPrekeys',
          payload: { prekeys: prekeyArrays },
        });

        logger.info(`Uploaded ${prekeyArrays.length} new prekeys`);
      } catch (error) {
        logger.error('Failed to replenish prekeys', error);
      }
    }
  }

  private handleDisconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
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

interface IncomingMessage {
  id: string;
  sender_id: string;
  conversation_id: string;
  ciphertext: number[];
  message_type: number;
  timestamp: number;
}

interface PrekeyBundleResponse {
  user_id: string;
  bundle: {
    identity_key: number[];
    signed_prekey: number[];
    signed_prekey_signature: number[];
    signed_prekey_id: number;
    one_time_prekey: number[] | null;
    one_time_prekey_id: number | null;
  } | null;
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
