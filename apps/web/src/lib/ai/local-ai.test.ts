import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MessageForAI } from './types';

/**
 * These tests pin two invariants of the Local AI module:
 *  1. Graceful degradation — if `@xenova/transformers` (or the model) fails to
 *     load, nothing throws and semantic search falls back to keyword search.
 *  2. Honest capabilities — `semanticSearch` is only reported available AFTER
 *     the embedding model has actually loaded.
 *
 * The transformers package is mocked so the suite never touches the network or
 * native ONNX bindings. `vi.resetModules()` gives each test a fresh module-level
 * cache (both the memoized transformers module and the LocalAI singleton).
 */

const messages: MessageForAI[] = [
  { id: 'm1', content: "let's split the restaurant bill", sender: 'a', timestamp: new Date(), isOwn: false },
  { id: 'm2', content: 'happy birthday to you', sender: 'b', timestamp: new Date(), isOwn: false },
  { id: 'm3', content: 'can you send the invoice payment', sender: 'a', timestamp: new Date(), isOwn: true },
];

// Deterministic 2D "embeddings": roughly [money, celebration].
function fakeVector(text: string): Float32Array {
  const t = text.toLowerCase();
  if (/bill|payment|invoice|money|split/.test(t)) return new Float32Array([1, 0.05]);
  if (/birthday|happy|celebrat/.test(t)) return new Float32Array([0.05, 1]);
  return new Float32Array([0.5, 0.5]);
}

describe('LocalAI semantic search', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('degrades gracefully to keyword search when the package fails to load', async () => {
    vi.doMock('@xenova/transformers', () => {
      throw new Error('native dependency unavailable');
    });

    const { LocalAI } = await import('./local-ai');
    const ai = LocalAI.getInstance();

    // Capability must not be advertised when nothing loaded.
    const ready = await ai.ensureSemanticSearch();
    expect(ready).toBe(false);
    expect(ai.getCapabilities().semanticSearch).toBe(false);
    expect(ai.isSemanticSearchReady()).toBe(false);

    // semanticSearch still works (keyword fallback) and never throws.
    const results = await ai.semanticSearch('payment', messages, 5);
    expect(results.some((r) => r.messageId === 'm3')).toBe(true);
  });

  it('only reports semanticSearch available after the model actually loads', async () => {
    const pipelineImpl = vi.fn(async (text: string) => ({ data: fakeVector(text) }));
    const pipeline = vi.fn(async () => pipelineImpl);
    vi.doMock('@xenova/transformers', () => ({
      pipeline,
      env: { allowLocalModels: true, useBrowserCache: false },
    }));

    const { LocalAI } = await import('./local-ai');
    const ai = LocalAI.getInstance();

    // Before loading: not advertised.
    expect(ai.getCapabilities().semanticSearch).toBe(false);

    const ready = await ai.ensureSemanticSearch();
    expect(ready).toBe(true);
    // After loading: advertised.
    expect(ai.getCapabilities().semanticSearch).toBe(true);
    expect(ai.isSemanticSearchReady()).toBe(true);
    expect(pipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  });

  it('ranks messages by semantic similarity to the query', async () => {
    const pipelineImpl = vi.fn(async (text: string) => ({ data: fakeVector(text) }));
    const pipeline = vi.fn(async () => pipelineImpl);
    vi.doMock('@xenova/transformers', () => ({
      pipeline,
      env: { allowLocalModels: true, useBrowserCache: false },
    }));

    const { LocalAI } = await import('./local-ai');
    const ai = LocalAI.getInstance();

    const results = await ai.semanticSearch('owe money for dinner', messages, 3);

    // The money-related messages should outrank the birthday one despite
    // sharing no keywords with the query.
    expect(results[0].messageId).not.toBe('m2');
    const birthday = results.find((r) => r.messageId === 'm2')!;
    const bill = results.find((r) => r.messageId === 'm1')!;
    expect(bill.score).toBeGreaterThan(birthday.score);
  });

  it('caches message embeddings so repeated searches re-embed only the query', async () => {
    const pipelineImpl = vi.fn(async (text: string) => ({ data: fakeVector(text) }));
    const pipeline = vi.fn(async () => pipelineImpl);
    vi.doMock('@xenova/transformers', () => ({
      pipeline,
      env: { allowLocalModels: true, useBrowserCache: false },
    }));

    const { LocalAI } = await import('./local-ai');
    const ai = LocalAI.getInstance();

    await ai.semanticSearch('money', messages, 3);
    const afterFirst = pipelineImpl.mock.calls.length; // 1 query + 3 messages = 4
    await ai.semanticSearch('money', messages, 3);
    const afterSecond = pipelineImpl.mock.calls.length;

    // Second search only embeds the query again (messages were cached).
    expect(afterSecond - afterFirst).toBe(1);
  });
});
