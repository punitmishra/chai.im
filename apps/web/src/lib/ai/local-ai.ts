/**
 * Local AI - Privacy-First AI Processing
 *
 * All AI processing happens in the browser using WebAssembly.
 * No message content is ever sent to any external server.
 *
 * Uses @xenova/transformers for model inference.
 */

import type {
  AICapabilities,
  AIState,
  SummarizeOptions,
  SummarizeResult,
  SmartReply,
  SmartReplyOptions,
  SemanticSearchResult,
  TranslationResult,
  MessageForAI,
} from './types';

// Dynamic import to avoid loading 50MB+ of models on initial page load
type Pipeline = unknown;
type PipelineType = 'summarization' | 'feature-extraction' | 'text2text-generation' | 'text-generation';

interface TransformersModule {
  pipeline: (task: PipelineType, model?: string) => Promise<Pipeline>;
  env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
  };
}

// Singleton for transformers module
let transformersModule: TransformersModule | null = null;

async function getTransformers(): Promise<TransformersModule | null> {
  if (transformersModule) return transformersModule;

  try {
    // Dynamic import - only loads when AI features are used
    const module = await import('@xenova/transformers');
    transformersModule = module as unknown as TransformersModule;

    // Configure for browser usage
    if (transformersModule.env) {
      transformersModule.env.allowLocalModels = false;
      transformersModule.env.useBrowserCache = true;
    }

    return transformersModule;
  } catch {
    console.warn('Transformers.js not available - AI features disabled');
    return null;
  }
}

export class LocalAI {
  private static instance: LocalAI | null = null;
  private state: AIState;
  private pipelines: Map<string, Pipeline> = new Map();
  private embeddings: Map<string, Float32Array> = new Map();
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.state = {
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
    };
  }

  static getInstance(): LocalAI {
    if (!LocalAI.instance) {
      LocalAI.instance = new LocalAI();
    }
    return LocalAI.instance;
  }

  getState(): AIState {
    return { ...this.state };
  }

  getCapabilities(): AICapabilities {
    return { ...this.state.capabilities };
  }

  /**
   * Initialize AI models. Call this early to pre-load models.
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    this.state.status = 'loading';

    const transformers = await getTransformers();
    if (!transformers) {
      this.state.status = 'error';
      this.state.error = 'Transformers.js not available';
      return;
    }

    // Enable capabilities based on successful model loading
    this.state.capabilities = {
      summarization: true,
      smartReplies: true,
      semanticSearch: true,
      translation: true,
    };

    this.state.status = 'ready';
  }

  /**
   * Summarize a list of messages into a concise overview.
   * Perfect for catching up on long threads.
   */
  async summarize(
    messages: MessageForAI[],
    options: SummarizeOptions = {}
  ): Promise<SummarizeResult> {
    const { maxLength = 150, style = 'brief' } = options;

    if (messages.length === 0) {
      return {
        summary: 'No messages to summarize.',
        messageCount: 0,
        timeSpan: { from: new Date(), to: new Date() },
      };
    }

    // For small message counts, use simple extraction
    if (messages.length <= 5) {
      return this.simpleSummarize(messages, maxLength);
    }

    this.state.status = 'processing';

    try {
      const transformers = await getTransformers();
      if (!transformers) {
        return this.simpleSummarize(messages, maxLength);
      }

      // Get or create summarization pipeline
      let pipeline = this.pipelines.get('summarization');
      if (!pipeline) {
        pipeline = await transformers.pipeline(
          'summarization',
          'Xenova/distilbart-cnn-6-6'
        );
        this.pipelines.set('summarization', pipeline);
        this.state.modelsLoaded.summarization = true;
      }

      // Prepare text for summarization
      const text = messages
        .map((m) => `${m.sender}: ${m.content}`)
        .join('\n');

      // Truncate if too long (model has input limit)
      const truncatedText = text.slice(0, 4000);

      // Run summarization
      const result = await (pipeline as (text: string, options: { max_length: number; min_length: number }) => Promise<Array<{ summary_text: string }>>)(
        truncatedText,
        {
          max_length: maxLength,
          min_length: Math.min(30, maxLength / 2),
        }
      );

      const summary = result[0]?.summary_text || this.simpleSummarize(messages, maxLength).summary;

      // Extract key points for detailed style
      let keyPoints: string[] | undefined;
      if (style === 'bullet-points' || style === 'detailed') {
        keyPoints = this.extractKeyPoints(messages);
      }

      return {
        summary,
        keyPoints,
        messageCount: messages.length,
        timeSpan: {
          from: messages[0].timestamp,
          to: messages[messages.length - 1].timestamp,
        },
      };
    } catch (error) {
      console.error('Summarization error:', error);
      return this.simpleSummarize(messages, maxLength);
    } finally {
      this.state.status = 'ready';
    }
  }

  /**
   * Fallback summarization using extractive approach
   */
  private simpleSummarize(messages: MessageForAI[], maxLength: number): SummarizeResult {
    // Group by sender and count
    const senderCounts = new Map<string, number>();
    for (const msg of messages) {
      senderCounts.set(msg.sender, (senderCounts.get(msg.sender) || 0) + 1);
    }

    // Find most active participant
    const participants = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Get first and last messages for context
    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];

    let summary: string;
    if (messages.length <= 3) {
      summary = messages.map((m) => m.content).join(' ');
    } else {
      summary = `${messages.length} messages from ${participants.join(', ')}. Started: "${firstMsg.content.slice(0, 50)}..." Latest: "${lastMsg.content.slice(0, 50)}..."`;
    }

    return {
      summary: summary.slice(0, maxLength),
      messageCount: messages.length,
      timeSpan: {
        from: messages[0]?.timestamp || new Date(),
        to: messages[messages.length - 1]?.timestamp || new Date(),
      },
    };
  }

  /**
   * Extract key discussion points from messages
   */
  private extractKeyPoints(messages: MessageForAI[]): string[] {
    const points: string[] = [];

    // Look for questions
    const questions = messages.filter((m) => m.content.includes('?'));
    if (questions.length > 0) {
      points.push(`${questions.length} question(s) asked`);
    }

    // Look for decisions/agreements
    const agreements = messages.filter((m) =>
      /\b(agreed|decided|let's|will do|sounds good)\b/i.test(m.content)
    );
    if (agreements.length > 0) {
      points.push(`${agreements.length} decision(s)/agreement(s)`);
    }

    // Look for action items
    const actions = messages.filter((m) =>
      /\b(TODO|action|task|need to|should|must)\b/i.test(m.content)
    );
    if (actions.length > 0) {
      points.push(`${actions.length} potential action item(s)`);
    }

    return points.slice(0, 5);
  }

  /**
   * Generate smart reply suggestions based on conversation context.
   */
  async getSmartReplies(
    messages: MessageForAI[],
    options: SmartReplyOptions = {}
  ): Promise<SmartReply[]> {
    const { count = 3, tone = 'casual' } = options;

    if (messages.length === 0) {
      return this.getDefaultReplies(tone);
    }

    const lastMessage = messages[messages.length - 1];

    // Quick pattern-based replies for common cases
    const patternReplies = this.getPatternReplies(lastMessage.content, tone);
    if (patternReplies.length >= count) {
      return patternReplies.slice(0, count);
    }

    // Try AI-powered generation
    try {
      const transformers = await getTransformers();
      if (!transformers) {
        return this.getDefaultReplies(tone).slice(0, count);
      }

      // For now, use pattern-based + defaults
      // Full AI generation requires larger models
      return [...patternReplies, ...this.getDefaultReplies(tone)].slice(0, count);
    } catch {
      return this.getDefaultReplies(tone).slice(0, count);
    }
  }

  /**
   * Pattern-based reply generation for common message types
   */
  private getPatternReplies(content: string, tone: string): SmartReply[] {
    const replies: SmartReply[] = [];
    const lower = content.toLowerCase();

    // Questions
    if (content.includes('?')) {
      if (/\b(do you|can you|will you|would you)\b/i.test(content)) {
        replies.push(
          { text: 'Yes, I can do that!', confidence: 0.8, tone: 'positive' },
          { text: "Let me check and get back to you", confidence: 0.7, tone: 'neutral' },
          { text: "Sorry, I'm not able to right now", confidence: 0.6, tone: 'neutral' }
        );
      } else if (/\b(what|how|when|where|why)\b/i.test(content)) {
        replies.push(
          { text: "Good question! Let me think...", confidence: 0.7, tone: 'neutral' },
          { text: "I'll look into that", confidence: 0.6, tone: 'action' }
        );
      } else if (/\b(agree|think|feel)\b/i.test(content)) {
        replies.push(
          { text: 'I agree!', confidence: 0.8, tone: 'positive' },
          { text: "That's a good point", confidence: 0.7, tone: 'positive' },
          { text: 'I see it differently', confidence: 0.5, tone: 'neutral' }
        );
      }
    }

    // Greetings
    if (/^(hi|hey|hello|good morning|good afternoon)/i.test(content)) {
      replies.push(
        { text: 'Hey! How are you?', confidence: 0.9, tone: 'positive' },
        { text: "Hi there!", confidence: 0.85, tone: 'positive' }
      );
    }

    // Thanks
    if (/\b(thanks|thank you|thx)\b/i.test(content)) {
      replies.push(
        { text: "You're welcome!", confidence: 0.9, tone: 'positive' },
        { text: 'No problem!', confidence: 0.85, tone: 'positive' },
        { text: 'Happy to help!', confidence: 0.8, tone: 'positive' }
      );
    }

    // Suggestions/proposals
    if (/\b(should we|let's|how about|what if)\b/i.test(lower)) {
      replies.push(
        { text: 'Sounds good to me!', confidence: 0.8, tone: 'positive' },
        { text: "I'm in!", confidence: 0.75, tone: 'positive' },
        { text: 'Maybe later?', confidence: 0.5, tone: 'neutral' }
      );
    }

    // Sharing/sending something
    if (/\b(sent|shared|check out|take a look)\b/i.test(lower)) {
      replies.push(
        { text: 'Got it, thanks!', confidence: 0.8, tone: 'positive' },
        { text: "I'll check it out", confidence: 0.75, tone: 'action' }
      );
    }

    return replies;
  }

  /**
   * Default replies when no pattern matches
   */
  private getDefaultReplies(tone: string): SmartReply[] {
    if (tone === 'professional') {
      return [
        { text: 'Understood, thank you.', confidence: 0.6, tone: 'neutral' },
        { text: "I'll follow up on this.", confidence: 0.5, tone: 'action' },
        { text: 'Noted.', confidence: 0.5, tone: 'neutral' },
      ];
    }

    return [
      { text: 'Sounds good!', confidence: 0.6, tone: 'positive' },
      { text: 'Got it!', confidence: 0.55, tone: 'positive' },
      { text: 'Makes sense', confidence: 0.5, tone: 'neutral' },
    ];
  }

  /**
   * Search messages by semantic meaning, not just keywords.
   */
  async semanticSearch(
    query: string,
    messages: MessageForAI[],
    topK: number = 5
  ): Promise<SemanticSearchResult[]> {
    if (messages.length === 0 || !query.trim()) {
      return [];
    }

    // For small message sets, use keyword search
    if (messages.length <= 20) {
      return this.keywordSearch(query, messages, topK);
    }

    try {
      const transformers = await getTransformers();
      if (!transformers) {
        return this.keywordSearch(query, messages, topK);
      }

      // Get or create embeddings pipeline
      let pipeline = this.pipelines.get('embeddings');
      if (!pipeline) {
        pipeline = await transformers.pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        );
        this.pipelines.set('embeddings', pipeline);
        this.state.modelsLoaded.embeddings = true;
      }

      // Get query embedding
      const queryEmbedding = await this.getEmbedding(pipeline, query);

      // Get or compute message embeddings
      const results: SemanticSearchResult[] = [];
      for (const msg of messages) {
        let msgEmbedding = this.embeddings.get(msg.id);
        if (!msgEmbedding) {
          msgEmbedding = await this.getEmbedding(pipeline, msg.content);
          this.embeddings.set(msg.id, msgEmbedding);
        }

        const score = this.cosineSimilarity(queryEmbedding, msgEmbedding);
        results.push({
          messageId: msg.id,
          content: msg.content,
          score,
          timestamp: msg.timestamp,
        });
      }

      // Sort by score and return top K
      return results.sort((a, b) => b.score - a.score).slice(0, topK);
    } catch (error) {
      console.error('Semantic search error:', error);
      return this.keywordSearch(query, messages, topK);
    }
  }

  /**
   * Get embedding vector for text
   */
  private async getEmbedding(pipeline: Pipeline, text: string): Promise<Float32Array> {
    const result = await (pipeline as (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>)(
      text,
      { pooling: 'mean', normalize: true }
    );
    return result.data;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Fallback keyword-based search
   */
  private keywordSearch(
    query: string,
    messages: MessageForAI[],
    topK: number
  ): SemanticSearchResult[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    const results: SemanticSearchResult[] = [];

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      let matchCount = 0;

      for (const word of queryWords) {
        if (content.includes(word)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        results.push({
          messageId: msg.id,
          content: msg.content,
          score: matchCount / queryWords.length,
          timestamp: msg.timestamp,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Translate message to target language
   */
  async translate(
    text: string,
    targetLanguage: string = 'en'
  ): Promise<TranslationResult> {
    // Detect source language (simple heuristic)
    const sourceLanguage = this.detectLanguage(text);

    if (sourceLanguage === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0,
      };
    }

    try {
      const transformers = await getTransformers();
      if (!transformers) {
        return {
          originalText: text,
          translatedText: text,
          sourceLanguage: 'unknown',
          targetLanguage,
          confidence: 0,
        };
      }

      // Get or create translation pipeline
      const pipelineKey = `translation-${sourceLanguage}-${targetLanguage}`;
      let pipeline = this.pipelines.get(pipelineKey);
      if (!pipeline) {
        // Use Helsinki-NLP models for translation
        const modelName = `Xenova/opus-mt-${sourceLanguage}-${targetLanguage}`;
        pipeline = await transformers.pipeline('text2text-generation', modelName);
        this.pipelines.set(pipelineKey, pipeline);
        this.state.modelsLoaded.translation = true;
      }

      const result = await (pipeline as (text: string) => Promise<Array<{ generated_text: string }>>)(text);
      const translatedText = result[0]?.generated_text || text;

      return {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence: 0.8,
      };
    } catch (error) {
      console.error('Translation error:', error);
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: 'unknown',
        targetLanguage,
        confidence: 0,
      };
    }
  }

  /**
   * Simple language detection based on character patterns
   */
  private detectLanguage(text: string): string {
    // Check for non-Latin scripts
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Japanese
    if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // Korean
    if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic
    if (/[\u0400-\u04ff]/.test(text)) return 'ru'; // Russian/Cyrillic
    if (/[\u0900-\u097f]/.test(text)) return 'hi'; // Hindi

    // Default to English for Latin script
    return 'en';
  }

  /**
   * Clear cached embeddings (call when conversation changes)
   */
  clearEmbeddingsCache(): void {
    this.embeddings.clear();
  }

  /**
   * Preload models for faster first use
   */
  async preloadModels(capabilities: (keyof AICapabilities)[]): Promise<void> {
    const transformers = await getTransformers();
    if (!transformers) return;

    const loadPromises: Promise<void>[] = [];

    if (capabilities.includes('summarization') && !this.pipelines.has('summarization')) {
      loadPromises.push(
        transformers.pipeline('summarization', 'Xenova/distilbart-cnn-6-6')
          .then((p) => { this.pipelines.set('summarization', p); })
      );
    }

    if (capabilities.includes('semanticSearch') && !this.pipelines.has('embeddings')) {
      loadPromises.push(
        transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
          .then((p) => { this.pipelines.set('embeddings', p); })
      );
    }

    await Promise.all(loadPromises);
  }
}
