'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
  const allMessages = useChatStore((state) => state.messages);
  const conversations = useChatStore((state) => state.conversations);

  // Filter messages with useMemo to avoid infinite loop
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === conversationId),
    [allMessages, conversationId]
  );

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

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
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-zinc-800/50 px-6 py-4 bg-zinc-900/30 backdrop-blur-xl">
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 font-semibold text-white text-lg shadow-inner">
            {recipientName.charAt(0).toUpperCase()}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 ${
              isOnline ? 'bg-green-500' : 'bg-zinc-500'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-lg truncate">{recipientName}</h1>
          <p className="text-sm text-zinc-500">
            {isOnline ? 'Online' : 'Connecting...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all duration-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all duration-200">
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
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900/50 mb-4">
                <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-zinc-500">No messages yet. Start the conversation!</p>
            </div>
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
      <form onSubmit={handleSend} className="border-t border-zinc-800/50 p-4 bg-zinc-900/30 backdrop-blur-xl">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-5 py-3.5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
            disabled={!isOnline}
          />
          <button
            type="submit"
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-105 active:scale-95 disabled:shadow-none disabled:scale-100"
            disabled={!input.trim() || isSending || !isOnline}
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
        className={`max-w-[75%] rounded-3xl px-5 py-3 ${
          isSelf
            ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20'
            : 'bg-zinc-800/70 text-white shadow-lg'
        }`}
      >
        {isCode ? (
          <CodeContent content={message.content} isSelf={isSelf} />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <p
            className={`text-xs ${isSelf ? 'text-amber-900/70' : 'text-zinc-500'}`}
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
      return (
        <div className="h-3 w-3 animate-spin rounded-full border border-amber-900/50 border-t-amber-900" />
      );
    case 'sent':
      return (
        <svg className="h-3.5 w-3.5 text-amber-900/70" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'delivered':
      return (
        <svg className="h-3.5 w-3.5 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
}

function CodeContent({ content, isSelf }: { content: string; isSelf: boolean }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            const [, lang, code] = match;
            return (
              <div key={i} className="overflow-x-auto rounded-2xl bg-zinc-900/80 p-4">
                {lang && (
                  <div className="mb-2 text-xs text-zinc-500 font-mono">{lang}</div>
                )}
                <pre className="font-mono text-sm text-green-400">
                  <code>{code.trim()}</code>
                </pre>
              </div>
            );
          }
        }
        return part ? (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {part}
          </p>
        ) : null;
      })}
    </div>
  );
}
