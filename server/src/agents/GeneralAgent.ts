import { GenerateOptions, LlmAdapter } from '../types';

export class GeneralAgent {
  constructor(private llmAdapter: LlmAdapter) {}

  async *generate({
    user,
    conversationId,
    message,
    history,
    abortSignal
  }: GenerateOptions): AsyncGenerator<string> {
    const prompt = this.composePrompt(message, history);
    
    try {
      const generator = this.llmAdapter.generate(prompt, abortSignal);
      
      for await (const chunk of generator) {
        if (abortSignal?.aborted) {
          break;
        }
        yield chunk;
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Generation aborted') {
        return; // Graceful abort
      }
      throw error;
    }
  }

  private composePrompt(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    const systemPrompt = `You are a helpful, harmless, and honest AI assistant. 
Your responses should be:
- Safe and appropriate for all audiences
- Informative and helpful when possible
- Honest about your limitations
- Respectful and professional

Refuse requests that could be harmful, illegal, or inappropriate.`;

    // Include last 5 turns of conversation history
    const recentHistory = history.slice(-5);
    
    let prompt = systemPrompt + '\n\n';
    
    if (recentHistory.length > 0) {
      prompt += 'Previous conversation:\n';
      for (const turn of recentHistory) {
        const roleLabel = turn.role === 'user' ? 'Human' : 'Assistant';
        prompt += `${roleLabel}: ${turn.content}\n`;
      }
      prompt += '\n';
    }
    
    prompt += `Human: ${message}\nAssistant:`;
    
    return prompt;
  }
}