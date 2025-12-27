'use client';

interface TypingIndicatorProps {
  conversationId: string;
  userName?: string;
  isTyping?: boolean; // Pass this prop from parent until real-time typing is implemented
}

export function TypingIndicator({ conversationId, userName, isTyping = false }: TypingIndicatorProps) {
  // TODO: Implement real-time typing state via WebSocket
  // For now, use the isTyping prop passed from parent

  if (!isTyping) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-zinc-500">
        {userName || 'Someone'} is typing...
      </span>
    </div>
  );
}

export function InlineTypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

export default TypingIndicator;
