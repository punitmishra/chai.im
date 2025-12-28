/**
 * AI Feature Types
 */

export interface AICapabilities {
  summarization: boolean;
  smartReplies: boolean;
  semanticSearch: boolean;
  translation: boolean;
}

export interface SummarizeOptions {
  maxLength?: number;
  style?: 'brief' | 'detailed' | 'bullet-points';
}

export interface SmartReplyOptions {
  count?: number;
  tone?: 'casual' | 'professional' | 'friendly';
}

export interface SummarizeResult {
  summary: string;
  keyPoints?: string[];
  messageCount: number;
  timeSpan: {
    from: Date;
    to: Date;
  };
}

export interface SmartReply {
  text: string;
  confidence: number;
  tone: 'positive' | 'neutral' | 'question' | 'action';
}

export interface SemanticSearchResult {
  messageId: string;
  content: string;
  score: number;
  timestamp: Date;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

export interface MessageForAI {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  isOwn: boolean;
}

export type AIStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'error';

export interface AIState {
  status: AIStatus;
  capabilities: AICapabilities;
  modelsLoaded: {
    summarization: boolean;
    embeddings: boolean;
    translation: boolean;
  };
  error: string | null;
}
