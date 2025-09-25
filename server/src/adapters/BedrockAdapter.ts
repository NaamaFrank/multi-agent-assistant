import { LlmAdapter } from './LlmAdapter';
import { LlmUsage } from '../types';

// Stub implementation for Bedrock - not wired yet
export class BedrockAdapter implements LlmAdapter {
  async *generate(prompt: string, abortSignal?: AbortSignal): AsyncGenerator<string, LlmUsage> {
    // TODO: Implement Bedrock integration
    throw new Error('BedrockAdapter not implemented yet');
  }
}