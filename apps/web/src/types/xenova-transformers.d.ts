/**
 * Type declarations for @xenova/transformers
 * This package provides browser-based ML inference.
 */
declare module '@xenova/transformers' {
  export type PipelineType =
    | 'text-generation'
    | 'text2text-generation'
    | 'summarization'
    | 'translation'
    | 'feature-extraction'
    | 'sentiment-analysis'
    | 'question-answering'
    | 'fill-mask'
    | 'zero-shot-classification'
    | 'token-classification';

  export interface PipelineOptions {
    progress_callback?: (progress: {
      status: string;
      file: string;
      progress: number;
    }) => void;
  }

  export interface TextGenerationOutput {
    generated_text: string;
  }

  export interface SummarizationOutput {
    summary_text: string;
  }

  export interface FeatureExtractionOutput {
    data: Float32Array;
  }

  export type PipelineOutput =
    | TextGenerationOutput[]
    | SummarizationOutput[]
    | FeatureExtractionOutput
    | unknown;

  export interface Pipeline {
    (input: string | string[], options?: Record<string, unknown>): Promise<PipelineOutput>;
  }

  export function pipeline(
    task: PipelineType,
    model?: string,
    options?: PipelineOptions
  ): Promise<Pipeline>;

  export const env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    cacheDir?: string;
  };
}
