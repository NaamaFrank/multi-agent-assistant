import { BedrockAdapter } from '../adapters/BedrockAdapter';

export interface StreamingOptions {
  onToken: (token: string) => void;
  onComplete: () => Promise<void>;
  onError: (error: Error) => void;
}

export const streamChatCompletion = async (
  userMessage: string, 
  options: StreamingOptions,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<void> => {
  try {
    // Build the full conversation context
    const fullHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage }
    ];
    
    // Convert conversation to a single prompt (Claude style)
    let prompt = '';
    for (const message of fullHistory) {
      if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    prompt += 'Assistant:';
    
    // Use BedrockAdapter for proper inference profile handling
    const adapter = new BedrockAdapter();
    
    try {
      const generator = adapter.generate(prompt);
      
      for await (const token of generator) {
        if (typeof token === 'string') {
          options.onToken(token);
        } else {
          // This is the final LlmUsage object
          console.log('Streaming completed with usage:', token);
          break;
        }
      }
      
      console.log('BedrockAdapter streaming completed successfully');
      await options.onComplete();
      
    } catch (error) {
      console.error('BedrockAdapter streaming error:', error);
      options.onError(error as Error);
    }

  } catch (error) {
    console.error('StreamingService error:', error);
    options.onError(error as Error);
  }
};