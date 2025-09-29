import { BedrockAdapter } from '../adapters/BedrockAdapter';
import { systemPrompt, type AgentKey, TITLE_PROMPT } from '../utils/prompts';
import type { ClaudeMessage } from '../types';

// Helper function to generate title using AI
const generateTitle = async (userMessage: string): Promise<string> => {
  const adapter = new BedrockAdapter();
  const gen = adapter.generate(userMessage, undefined, TITLE_PROMPT);
  
  let title = '';
  for await (const chunk of gen) {
    title += chunk;
  }
  
  return title.trim();
};

export interface StreamingOptions {
  onToken: (t: string) => void;
  onTitle?: (title: string) => void;
  onComplete: (generatedTitle?: string) => Promise<void>;
  onError: (e: Error) => void;
}

export const streamChatCompletion = async (
  userMessage: string,
  options: StreamingOptions,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  agent: AgentKey = 'general',
  conversationId?: string
): Promise<void> => {
  try {
    const messages: ClaudeMessage[] = [
      ...conversationHistory.slice(-5), 
      { role: 'user', content: userMessage }
    ];

    const adapter = new BedrockAdapter();
    const gen = adapter.generate(messages, /* abortSignal */ undefined, systemPrompt(agent));

    // Check if this is first message and should generate title
    const isFirstMessage = conversationHistory.length === 0;
    let titlePromise: Promise<string | null> = Promise.resolve(null);
    
    if (conversationId && isFirstMessage && options.onTitle) {
      titlePromise = generateTitle(userMessage).catch((error: any) => {
        console.error('Failed to generate title:', error);
        return null;
      });
    }

    // Stream AI response tokens
    for await (const token of gen) options.onToken(token);
    
    // Handle title after response completes
    let generatedTitle: string | null = null;
    if (conversationId && isFirstMessage && options.onTitle) {
      try {
        generatedTitle = await titlePromise;
        if (generatedTitle) {
          options.onTitle(generatedTitle);
        }
      } catch (titleError) {
        console.error('Failed to generate title:', titleError);
      }
    }
    
    await options.onComplete(generatedTitle || undefined);
  } catch (err) {
    options.onError(err as Error);
  }
};
