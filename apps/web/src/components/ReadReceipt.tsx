'use client';

import { useState } from 'react';
import { Message } from '@/store/chatStore';

/**
 * Read info for a user who has read a message.
 */
export interface ReadInfo {
  userId: string;
  userName: string;
  readAt: number; // Unix timestamp in milliseconds
}

interface ReadReceiptProps {
  status: Message['status'];
  className?: string;
  /** List of users who have read the message (for group chats). */
  readBy?: ReadInfo[];
  /** Total number of recipients (for calculating read ratio). */
  totalRecipients?: number;
}

export function ReadReceipt({
  status,
  className = '',
  readBy = [],
  totalRecipients = 1,
}: ReadReceiptProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // For group messages, determine if all have read
  const allRead = readBy.length >= totalRecipients && totalRecipients > 0;
  const someRead = readBy.length > 0 && readBy.length < totalRecipients;

  const getIcon = () => {
    switch (status) {
      case 'sending':
        return (
          <div className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current ${className}`} />
        );

      case 'sent':
        return (
          <svg className={`h-4 w-4 text-slate-400 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );

      case 'delivered':
        return (
          <svg className={`h-4 w-4 text-slate-400 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l4 4L23 7" transform="translate(-4, 0)" />
          </svg>
        );

      case 'read':
        // For group messages with partial reads, use a different color
        const colorClass = allRead ? 'text-cyan-500' : (someRead ? 'text-cyan-500/60' : 'text-cyan-500');
        return (
          <svg className={`h-4 w-4 ${colorClass} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l4 4L23 7" transform="translate(-4, 0)" />
          </svg>
        );

      default:
        return null;
    }
  };

  // If there are multiple readers, show tooltip on hover
  if (readBy.length > 0 && (status === 'read' || status === 'delivered')) {
    return (
      <div
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {getIcon()}

        {/* Tooltip showing who read the message */}
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <ReadByTooltip readBy={readBy} totalRecipients={totalRecipients} />
          </div>
        )}
      </div>
    );
  }

  return getIcon();
}

/**
 * Tooltip showing who has read a message.
 */
function ReadByTooltip({ readBy, totalRecipients }: { readBy: ReadInfo[]; totalRecipients: number }) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const unreadCount = totalRecipients - readBy.length;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg shadow-xl p-3 min-w-[180px] max-w-[250px]">
      <div className="text-xs font-medium text-slate-300 mb-2">
        Read by {readBy.length} of {totalRecipients}
      </div>

      <div className="space-y-2">
        {readBy.slice(0, 5).map((info) => (
          <div key={info.userId} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Small avatar */}
              <div className="h-5 w-5 rounded-full bg-dark-600 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-medium text-slate-200">
                  {info.userName.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-slate-300 truncate">
                {info.userName}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 whitespace-nowrap">
              {formatTime(info.readAt)}
            </span>
          </div>
        ))}

        {readBy.length > 5 && (
          <div className="text-xs text-slate-500">
            +{readBy.length - 5} more
          </div>
        )}

        {unreadCount > 0 && (
          <div className="text-xs text-slate-500 pt-1 border-t border-dark-600">
            {unreadCount} haven't seen yet
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple double-check icon component.
 */
export function DoubleCheck({ read, className = '' }: { read: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className={`h-4 w-4 ${read ? 'text-cyan-500' : 'text-slate-400'}`}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 8L5.5 11.5L11 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 8L8.5 11.5L14 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * Compact read receipt with count for group messages.
 */
export function GroupReadReceipt({
  readCount,
  totalCount,
  className = '',
}: {
  readCount: number;
  totalCount: number;
  className?: string;
}) {
  if (totalCount <= 1) {
    return <DoubleCheck read={readCount > 0} className={className} />;
  }

  const allRead = readCount >= totalCount;
  const colorClass = allRead ? 'text-cyan-500' : 'text-slate-400';

  return (
    <div className={`flex items-center gap-1 ${colorClass} ${className}`}>
      <DoubleCheck read={readCount > 0} />
      <span className="text-[10px]">
        {readCount}/{totalCount}
      </span>
    </div>
  );
}

/**
 * "Seen by" indicator for group messages.
 */
export function SeenByIndicator({
  readBy,
  maxDisplay = 3,
  className = '',
}: {
  readBy: ReadInfo[];
  maxDisplay?: number;
  className?: string;
}) {
  if (readBy.length === 0) {
    return null;
  }

  const displayNames = readBy.slice(0, maxDisplay).map(r => r.userName);
  const remaining = readBy.length - maxDisplay;

  let text = '';
  if (displayNames.length === 1) {
    text = `Seen by ${displayNames[0]}`;
  } else if (displayNames.length === 2) {
    text = `Seen by ${displayNames[0]} and ${displayNames[1]}`;
  } else if (remaining > 0) {
    text = `Seen by ${displayNames.join(', ')} and ${remaining} more`;
  } else {
    text = `Seen by ${displayNames.slice(0, -1).join(', ')} and ${displayNames[displayNames.length - 1]}`;
  }

  return (
    <span className={`text-xs text-slate-500 ${className}`}>
      {text}
    </span>
  );
}

export default ReadReceipt;
