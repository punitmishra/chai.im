'use client';

import React from 'react';
import type { SmartReply } from './types';

interface SmartRepliesProps {
  replies: SmartReply[];
  onSelect: (reply: string) => void;
  loading?: boolean;
  className?: string;
}

export function SmartReplies({ replies, onSelect, loading, className = '' }: SmartRepliesProps) {
  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-dark-600 border-t-cyan-500" />
        <span className="text-xs text-slate-500">Thinking...</span>
      </div>
    );
  }

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 px-3 py-2 ${className}`}>
      <span className="text-xs text-slate-500 self-center mr-1">Quick replies:</span>
      {replies.map((reply, index) => (
        <button
          key={index}
          onClick={() => onSelect(reply.text)}
          className="px-3 py-1.5 text-sm bg-dark-800/50 hover:bg-dark-700/50 text-slate-300 hover:text-white rounded-full border border-dark-600/50 hover:border-cyan-500/30 transition-all duration-200 active:scale-95"
        >
          {reply.text}
        </button>
      ))}
    </div>
  );
}

/**
 * Summarize button that shows a tooltip with the summary
 */
interface SummarizeButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function SummarizeButton({ onClick, loading, disabled }: SummarizeButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 hover:text-purple-200 rounded-lg border border-purple-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Summarize conversation (AI-powered, runs locally)"
    >
      {loading ? (
        <>
          <div className="h-3 w-3 animate-spin rounded-full border border-purple-400 border-t-transparent" />
          <span>Summarizing...</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Summarize</span>
        </>
      )}
    </button>
  );
}

/**
 * Search bar for semantic search
 */
interface SemanticSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  loading?: boolean;
  placeholder?: string;
}

export function SemanticSearchBar({
  value,
  onChange,
  onSearch,
  loading,
  placeholder = 'Search by meaning...',
}: SemanticSearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-2 pl-10 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
      />
      <svg
        className="absolute left-3 w-4 h-4 text-slate-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {loading && (
        <div className="absolute right-3 h-4 w-4 animate-spin rounded-full border-2 border-dark-600 border-t-cyan-500" />
      )}
    </div>
  );
}

/**
 * AI features badge to show local processing
 */
export function AIBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-full">
      <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
      </svg>
      <span className="text-xs text-purple-300">Local AI</span>
    </div>
  );
}

/**
 * Summary display component
 */
interface SummaryDisplayProps {
  summary: string;
  keyPoints?: string[];
  messageCount: number;
  onClose: () => void;
}

export function SummaryDisplay({ summary, keyPoints, messageCount, onClose }: SummaryDisplayProps) {
  return (
    <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <AIBadge />
          <span className="text-xs text-slate-500">{messageCount} messages summarized</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-dark-700/50 rounded transition-colors"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-white leading-relaxed">{summary}</p>
      {keyPoints && keyPoints.length > 0 && (
        <ul className="mt-3 space-y-1">
          {keyPoints.map((point, index) => (
            <li key={index} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1 h-1 bg-purple-400 rounded-full" />
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
