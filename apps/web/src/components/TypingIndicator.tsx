'use client';

import { AvatarWithPresence } from './OnlineStatus';

/**
 * Information about a user who is typing.
 */
export interface TypingUser {
  userId: string;
  userName: string;
}

interface TypingIndicatorProps {
  /** The conversation ID for context. */
  conversationId: string;
  /** Single user name (for backwards compatibility). */
  userName?: string;
  /** Whether typing is happening (for backwards compatibility). */
  isTyping?: boolean;
  /** List of users currently typing (enhanced mode). */
  typingUsers?: TypingUser[];
  /** Show user avatars alongside the indicator. */
  showAvatars?: boolean;
}

export function TypingIndicator({
  conversationId,
  userName,
  isTyping = false,
  typingUsers = [],
  showAvatars = true,
}: TypingIndicatorProps) {
  // Use typingUsers if provided, otherwise fall back to single userName
  const users = typingUsers.length > 0
    ? typingUsers
    : (userName && isTyping ? [{ userId: '', userName }] : []);

  if (users.length === 0) {
    return null;
  }

  // Format the typing text based on number of users
  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].userName} is typing...`;
    } else if (users.length === 2) {
      return `${users[0].userName} and ${users[1].userName} are typing...`;
    } else if (users.length === 3) {
      return `${users[0].userName}, ${users[1].userName}, and ${users[2].userName} are typing...`;
    } else {
      return `${users[0].userName}, ${users[1].userName}, and ${users.length - 2} others are typing...`;
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-slate-400">
      {/* User avatars (up to 3) */}
      {showAvatars && users.length > 0 && (
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((user, index) => (
            user.userId ? (
              <AvatarWithPresence
                key={user.userId}
                userId={user.userId}
                name={user.userName}
                size="sm"
                className="ring-2 ring-dark-900"
              />
            ) : (
              <div
                key={index}
                className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center ring-2 ring-dark-900"
              >
                <span className="text-xs font-medium text-slate-200">
                  {user.userName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )
          ))}
          {users.length > 3 && (
            <div className="h-8 w-8 rounded-full bg-dark-600 flex items-center justify-center ring-2 ring-dark-900">
              <span className="text-xs font-medium text-slate-200">+{users.length - 3}</span>
            </div>
          )}
        </div>
      )}

      {/* Typing dots animation */}
      <div className="flex gap-1">
        <span
          className="h-2 w-2 rounded-full bg-cyan-500/70 animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '0.8s' }}
        />
        <span
          className="h-2 w-2 rounded-full bg-cyan-500/70 animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '0.8s' }}
        />
        <span
          className="h-2 w-2 rounded-full bg-cyan-500/70 animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '0.8s' }}
        />
      </div>

      {/* Typing text */}
      <span className="text-sm">
        {getTypingText()}
      </span>
    </div>
  );
}

/**
 * Compact typing indicator for inline use.
 */
export function InlineTypingIndicator({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span
        className="h-1.5 w-1.5 rounded-full bg-cyan-500/70 animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '0.8s' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-cyan-500/70 animate-bounce"
        style={{ animationDelay: '150ms', animationDuration: '0.8s' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-cyan-500/70 animate-bounce"
        style={{ animationDelay: '300ms', animationDuration: '0.8s' }}
      />
    </span>
  );
}

/**
 * Minimal typing indicator (just text with dots).
 */
export function MinimalTypingIndicator({ userName }: { userName?: string }) {
  return (
    <span className="text-sm text-slate-500 italic">
      {userName || 'Someone'} is typing
      <InlineTypingIndicator className="ml-1" />
    </span>
  );
}

/**
 * Typing indicator for conversation list sidebar.
 */
export function SidebarTypingIndicator({ userName }: { userName?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-cyan-500/80">
      <InlineTypingIndicator />
      <span className="text-xs truncate">
        {userName ? `${userName} typing...` : 'typing...'}
      </span>
    </div>
  );
}

export default TypingIndicator;
