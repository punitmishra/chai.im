'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useChatStore, Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useConnectionStore } from '@/store/connectionStore';
import { getWebSocketClient, connectIfAuthenticated } from '@/lib/ws/client';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get state from stores
  const user = useAuthStore((state) => state.user);
  const connectionStatus = useConnectionStore((state) => state.status);
  const messages = useChatStore((state) =>
    state.messages.filter((m) => m.conversationId === conversationId)
  );
  const conversations = useChatStore((state) => state.conversations);
  const conversation = conversations.find((c) => c.id === conversationId);

  // Connect to WebSocket on mount
  useEffect(() => {
    connectIfAuthenticated();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Request prekey bundle when starting a new conversation
  useEffect(() => {
    if (conversation && !conversation.hasSession) {
      const client = getWebSocketClient();
      client.requestPrekeyBundle(conversation.recipientId);
    }
  }, [conversation]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !conversation) return;

    setIsSending(true);
    const content = input;
    setInput('');

    try {
      const client = getWebSocketClient();
      await client.sendEncryptedMessage(
        conversation.recipientId,
        conversationId,
        content
      );

      // Add message to local state (will be updated when server confirms)
      useChatStore.getState().addMessage({
        id: `pending-${Date.now()}`,
        conversationId,
        senderId: user?.id || '',
        content,
        timestamp: Date.now(),
        status: 'sending',
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add the content to input on failure
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const recipientName = conversation?.name || 'Chat';
  const isOnline = connectionStatus === 'connected';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-dark-800 px-6 py-4">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dark-700 font-medium">
            {recipientName.charAt(0).toUpperCase()}
          </div>
          <span
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-dark-950 ${
              isOnline ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
        </div>
        <div>
          <h1 className="font-semibold">{recipientName}</h1>
          <p className="text-sm text-dark-400">
            {isOnline ? 'Online' : 'Connecting...'}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost p-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="btn-ghost p-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-dark-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSelf={message.senderId === user?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-dark-800 p-4">
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="input flex-1"
            disabled={!isOnline}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!input.trim() || isSending || !isOnline}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  isSelf,
}: {
  message: Message;
  isSelf: boolean;
}) {
  const isCode = message.content.includes('```');
  const timestamp = new Date(message.timestamp);

  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isSelf ? 'bg-primary-500 text-white' : 'bg-dark-800 text-white'
        }`}
      >
        {isCode ? (
          <CodeContent content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <p
            className={`text-xs ${isSelf ? 'text-primary-200' : 'text-dark-400'}`}
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
    </div>
  );
}

function MessageStatus({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'sending':
      return <span className="text-xs text-primary-300">Sending...</span>;
    case 'sent':
      return (
        <svg className="h-3 w-3 text-primary-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'delivered':
      return (
        <svg className="h-3 w-3 text-primary-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
}

function CodeContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            const [, lang, code] = match;
            return (
              <div key={i} className="overflow-x-auto rounded-lg bg-dark-900 p-3">
                {lang && (
                  <div className="mb-2 text-xs text-dark-400">{lang}</div>
                )}
                <pre className="font-mono text-sm text-green-400">
                  <code>{code.trim()}</code>
                </pre>
              </div>
            );
          }
        }
        return part ? (
          <p key={i} className="whitespace-pre-wrap">
            {part}
          </p>
        ) : null;
      })}
    </div>
  );
}
