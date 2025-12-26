'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isSelf: boolean;
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Alice',
      content: 'Hey! How are you?',
      timestamp: new Date(Date.now() - 60000),
      isSelf: false,
    },
    {
      id: '2',
      sender: 'You',
      content: 'Pretty good! Working on the new chat app.',
      timestamp: new Date(Date.now() - 50000),
      isSelf: true,
    },
    {
      id: '3',
      sender: 'Alice',
      content: 'Oh nice! The E2E encrypted one?',
      timestamp: new Date(Date.now() - 40000),
      isSelf: false,
    },
    {
      id: '4',
      sender: 'You',
      content: 'Yes! Check this out:\n```rust\nfn encrypt(msg: &str) -> Vec<u8> {\n    // Signal Protocol\n}\n```',
      timestamp: new Date(Date.now() - 30000),
      isSelf: true,
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      content: input,
      timestamp: new Date(),
      isSelf: true,
    };

    setMessages([...messages, newMessage]);
    setInput('');

    // TODO: Send via WebSocket with encryption
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-dark-800 px-6 py-4">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dark-700 font-medium">
            A
          </div>
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-dark-950 bg-green-500" />
        </div>
        <div>
          <h1 className="font-semibold">Alice</h1>
          <p className="text-sm text-dark-400">Online</p>
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
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
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
          />
          <button type="submit" className="btn-primary" disabled={!input.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isCode = message.content.includes('```');

  return (
    <div className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          message.isSelf
            ? 'bg-primary-500 text-white'
            : 'bg-dark-800 text-white'
        }`}
      >
        {isCode ? (
          <CodeContent content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        <p
          className={`mt-1 text-xs ${
            message.isSelf ? 'text-primary-200' : 'text-dark-400'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
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
        return part ? <p key={i} className="whitespace-pre-wrap">{part}</p> : null;
      })}
    </div>
  );
}
