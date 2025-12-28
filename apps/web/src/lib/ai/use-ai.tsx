'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { LocalAI } from './local-ai';
import type {
  AIState,
  AICapabilities,
  SummarizeResult,
  SmartReply,
  SemanticSearchResult,
  MessageForAI,
  SummarizeOptions,
  SmartReplyOptions,
} from './types';

interface AIContextValue {
  state: AIState;
  capabilities: AICapabilities;
  isReady: boolean;
  isProcessing: boolean;

  // Actions
  initialize: () => Promise<void>;
  summarize: (messages: MessageForAI[], options?: SummarizeOptions) => Promise<SummarizeResult>;
  getSmartReplies: (messages: MessageForAI[], options?: SmartReplyOptions) => Promise<SmartReply[]>;
  semanticSearch: (query: string, messages: MessageForAI[], topK?: number) => Promise<SemanticSearchResult[]>;
  translate: (text: string, targetLanguage?: string) => Promise<string>;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const aiRef = useRef<LocalAI | null>(null);
  const [state, setState] = useState<AIState>({
    status: 'idle',
    capabilities: {
      summarization: false,
      smartReplies: false,
      semanticSearch: false,
      translation: false,
    },
    modelsLoaded: {
      summarization: false,
      embeddings: false,
      translation: false,
    },
    error: null,
  });

  // Initialize AI on mount (lazily)
  useEffect(() => {
    aiRef.current = LocalAI.getInstance();
  }, []);

  const initialize = useCallback(async () => {
    if (!aiRef.current) {
      aiRef.current = LocalAI.getInstance();
    }
    await aiRef.current.initialize();
    setState(aiRef.current.getState());
  }, []);

  const summarize = useCallback(
    async (messages: MessageForAI[], options?: SummarizeOptions): Promise<SummarizeResult> => {
      if (!aiRef.current) {
        aiRef.current = LocalAI.getInstance();
      }
      setState((s) => ({ ...s, status: 'processing' }));
      try {
        const result = await aiRef.current.summarize(messages, options);
        setState(aiRef.current.getState());
        return result;
      } finally {
        setState((s) => ({ ...s, status: 'ready' }));
      }
    },
    []
  );

  const getSmartReplies = useCallback(
    async (messages: MessageForAI[], options?: SmartReplyOptions): Promise<SmartReply[]> => {
      if (!aiRef.current) {
        aiRef.current = LocalAI.getInstance();
      }
      return aiRef.current.getSmartReplies(messages, options);
    },
    []
  );

  const semanticSearch = useCallback(
    async (
      query: string,
      messages: MessageForAI[],
      topK: number = 5
    ): Promise<SemanticSearchResult[]> => {
      if (!aiRef.current) {
        aiRef.current = LocalAI.getInstance();
      }
      return aiRef.current.semanticSearch(query, messages, topK);
    },
    []
  );

  const translate = useCallback(
    async (text: string, targetLanguage: string = 'en'): Promise<string> => {
      if (!aiRef.current) {
        aiRef.current = LocalAI.getInstance();
      }
      const result = await aiRef.current.translate(text, targetLanguage);
      return result.translatedText;
    },
    []
  );

  const value: AIContextValue = {
    state,
    capabilities: state.capabilities,
    isReady: state.status === 'ready',
    isProcessing: state.status === 'processing',
    initialize,
    summarize,
    getSmartReplies,
    semanticSearch,
    translate,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

/**
 * Hook for smart reply suggestions
 */
export function useSmartReplies(messages: MessageForAI[], enabled: boolean = true) {
  const { getSmartReplies } = useAI();
  const [replies, setReplies] = useState<SmartReply[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || messages.length === 0) {
      setReplies([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getSmartReplies(messages.slice(-5)) // Only use last 5 messages for context
      .then((result) => {
        if (!cancelled) {
          setReplies(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messages, enabled, getSmartReplies]);

  return { replies, loading };
}

/**
 * Hook for conversation summarization
 */
export function useSummarize() {
  const { summarize } = useAI();
  const [result, setResult] = useState<SummarizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSummarize = useCallback(
    async (messages: MessageForAI[], options?: SummarizeOptions) => {
      setLoading(true);
      setError(null);
      try {
        const summary = await summarize(messages, options);
        setResult(summary);
        return summary;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Summarization failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [summarize]
  );

  return { summarize: doSummarize, result, loading, error };
}

/**
 * Hook for semantic search
 */
export function useSemanticSearch(messages: MessageForAI[]) {
  const { semanticSearch } = useAI();
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return [];
      }

      setQuery(searchQuery);
      setLoading(true);

      try {
        const searchResults = await semanticSearch(searchQuery, messages);
        setResults(searchResults);
        return searchResults;
      } finally {
        setLoading(false);
      }
    },
    [messages, semanticSearch]
  );

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { search, results, loading, query, clear };
}
