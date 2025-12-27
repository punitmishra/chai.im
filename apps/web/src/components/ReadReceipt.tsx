'use client';

import { Message } from '@/store/chatStore';

interface ReadReceiptProps {
  status: Message['status'];
  className?: string;
}

export function ReadReceipt({ status, className = '' }: ReadReceiptProps) {
  switch (status) {
    case 'sending':
      return (
        <div className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current ${className}`} />
      );

    case 'sent':
      return (
        <svg className={`h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );

    case 'delivered':
      return (
        <svg className={`h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l4 4L23 7" transform="translate(-4, 0)" />
        </svg>
      );

    case 'read':
      return (
        <svg className={`h-4 w-4 text-amber-500 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l4 4L23 7" transform="translate(-4, 0)" />
        </svg>
      );

    default:
      return null;
  }
}

export function DoubleCheck({ read, className = '' }: { read: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className={`h-4 w-4 ${read ? 'text-amber-500' : 'text-current'}`}
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

export default ReadReceipt;
