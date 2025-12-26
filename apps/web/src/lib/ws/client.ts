/**
 * WebSocket client for real-time messaging.
 */

import { useConnectionStore } from '@/store/connectionStore';
import { useChatStore, Message } from '@/store/chatStore';

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
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    useConnectionStore.getState().setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
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
    }
  }

  private handleIncomingMessage(payload: IncomingMessage): void {
    // TODO: Decrypt message using WASM crypto
    const message: Message = {
      id: payload.id,
      conversationId: payload.conversation_id,
      senderId: payload.sender_id,
      content: '[Encrypted]', // Will be decrypted
      timestamp: payload.timestamp,
      status: 'delivered',
    };

    useChatStore.getState().addMessage(message);
  }

  private handleMessageSent(payload: { message_id: string }): void {
    useChatStore.getState().updateMessageStatus(payload.message_id, 'sent');
  }

  private handleDisconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    const store = useConnectionStore.getState();
    store.setStatus('disconnected');

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

// Singleton instance
let client: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!client) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
    client = new WebSocketClient(wsUrl);
  }
  return client;
}
