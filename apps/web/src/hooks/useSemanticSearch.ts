'use client';

/**
 * Standalone semantic-search hook.
 *
 * Talks to the `LocalAI` singleton directly (no React context / AIProvider
 * required), so it can be dropped into any component. The embedding model is
 * loaded lazily on first search and everything runs in the browser — no
 * message content ever leaves the device.
 */

import { useCallback, useRef, useState } from 'react';
import { LocalAI } from '@/lib/ai/local-ai';
import type { MessageForAI, SemanticSearchResult } from '@/lib/ai/types';

export type SemanticStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface UseSemanticSearch {
  /** Lifecycle of the embedding model. */
  status: SemanticStatus;
  /** True while a query is being embedded/ranked. */
  searching: boolean;
  /**
   * Ensure the model is loaded. Resolves to `true` when semantic search is
   * available, `false` when it could not be loaded (degrade to keyword search).
   */
  ensureReady: () => Promise<boolean>;
  /**
   * Run a semantic search. Returns ranked results, or `null` when semantic
   * search is unavailable so callers can fall back to keyword search.
   */
  search: (
    query: string,
    messages: MessageForAI[],
    topK?: number
  ) => Promise<SemanticSearchResult[] | null>;
}

export function useSemanticSearch(): UseSemanticSearch {
  const aiRef = useRef<LocalAI | null>(null);
  const [status, setStatus] = useState<SemanticStatus>('idle');
  const [searching, setSearching] = useState(false);

  const getAI = (): LocalAI => {
    if (!aiRef.current) {
      aiRef.current = LocalAI.getInstance();
    }
    return aiRef.current;
  };

  const ensureReady = useCallback(async (): Promise<boolean> => {
    const ai = getAI();
    if (ai.isSemanticSearchReady()) {
      setStatus('ready');
      return true;
    }
    setStatus('loading');
    try {
      const ok = await ai.ensureSemanticSearch();
      setStatus(ok ? 'ready' : 'unavailable');
      return ok;
    } catch {
      // ensureSemanticSearch is designed never to throw, but guard anyway.
      setStatus('unavailable');
      return false;
    }
  }, []);

  const search = useCallback(
    async (
      query: string,
      messages: MessageForAI[],
      topK = 30
    ): Promise<SemanticSearchResult[] | null> => {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const ai = getAI();
      const ok = await ensureReady();
      if (!ok) return null;

      setSearching(true);
      try {
        return await ai.semanticSearch(trimmed, messages, topK);
      } catch {
        setStatus('unavailable');
        return null;
      } finally {
        setSearching(false);
      }
    },
    [ensureReady]
  );

  return { status, searching, ensureReady, search };
}
