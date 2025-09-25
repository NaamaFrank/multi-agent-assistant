import { LlmUsage } from '../types';

export interface LlmAdapter {
  generate(
    prompt: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<string, LlmUsage>;
}

export interface GenerateOptions {
  user: { userId: number };
  conversationId: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  abortSignal?: AbortSignal;
}