/**
 * WebSocket client for real-time messaging.
 */

import { useConnectionStore } from '@/store/connectionStore';
import { useChatStore, Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { decryptMessage, initSession } from '@/lib/crypto/wasm';

type MessageHandler = (message: ServerMessage) => void;

interface ClientMessage {
  type: string;
  payload: unknown;
}

interface ServerMessage {
  type: string;
  payload: unknown;
}

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

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
      console.warn('No session token, cannot connect to WebSocket');
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
      console.error('WebSocket connection failed:', error);
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
      console.warn('WebSocket not connected, message not sent');
      return;
    }

    this.ws.send(JSON.stringify(message));
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
      console.error('Failed to encrypt message:', error);
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

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      useConnectionStore.getState().setStatus('connected');
      useConnectionStore.getState().resetReconnectAttempts();
      this.startPingInterval();
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      useConnectionStore.getState().setStatus('error', 'Connection error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }

  private handleMessage(message: ServerMessage): void {
    const handlers = this.handlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Handler error:', error);
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
      console.error('Failed to decrypt message:', error);
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
        console.log('Session initialized with user:', payload.user_id);
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    }
  }

  private async handleLowPrekeys(payload: { remaining: number }): Promise<void> {
    console.warn(`Low prekeys warning: ${payload.remaining} remaining`);
    // TODO: Generate and upload more one-time prekeys
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
    }, 30000);
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
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
    client = new WebSocketClient(wsUrl);
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
