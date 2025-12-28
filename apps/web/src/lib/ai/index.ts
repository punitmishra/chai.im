/**
 * Chai.im Local AI Module
 *
 * Privacy-first AI features that run entirely in the browser.
 * No message content ever leaves the device.
 *
 * Features:
 * - Message summarization (catch up on long threads)
 * - Smart reply suggestions
 * - Semantic search (find messages by meaning)
 * - Auto-translation
 */

export { LocalAI } from './local-ai';
export { useAI, AIProvider } from './use-ai';
export { SmartReplies } from './smart-replies';
export type { AICapabilities, SummarizeOptions, SmartReplyOptions } from './types';
