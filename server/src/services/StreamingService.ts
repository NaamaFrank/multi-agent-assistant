import { BedrockAdapter } from '../adapters/BedrockAdapter';
import { systemPrompt, type AgentKey } from '../utils/prompts';
import type { ClaudeMessage } from '../types';

export interface StreamingOptions {
  onToken: (t: string) => void;
  onComplete: () => Promise<void>;
  onError: (e: Error) => void;
}

export const streamChatCompletion = async (
  userMessage: string,
  options: StreamingOptions,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  agent: AgentKey = 'general'
): Promise<void> => {
  try {
    const messages: ClaudeMessage[] = [
      ...conversationHistory.slice(-5), 
      { role: 'user', content: userMessage }
    ];

    const adapter = new BedrockAdapter();
    const gen = adapter.generate(messages, /* abortSignal */ undefined, systemPrompt(agent));

    for await (const token of gen) options.onToken(token);
    await options.onComplete();
  } catch (err) {
    options.onError(err as Error);
  }
};