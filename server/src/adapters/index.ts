import { LlmAdapter } from './LlmAdapter';
import { FakeAdapter } from './FakeAdapter';
import { BedrockAdapter } from './BedrockAdapter';

export function createLlmAdapter(): LlmAdapter {
  const useFake = process.env.USE_FAKE_LLM === 'true';
  
  if (useFake) {
    return new FakeAdapter();
  }
  
  // TODO: Return BedrockAdapter when ready
  return new FakeAdapter();
}

export * from './LlmAdapter';
export * from './FakeAdapter';
export * from './BedrockAdapter';