import { LlmAdapter } from '../types';
import { FakeAdapter } from './FakeAdapter';
import { BedrockAdapter } from './BedrockAdapter';

export function createLlmAdapter(): LlmAdapter {
  const useFake = process.env.USE_FAKE_LLM === 'true';
  
  if (useFake) {
    return new FakeAdapter();
  }
  
  return new BedrockAdapter();
}

export * from './FakeAdapter';
export * from './BedrockAdapter';