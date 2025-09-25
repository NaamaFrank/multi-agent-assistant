import { LlmAdapter } from './LlmAdapter';
import { LlmUsage } from '../types';

export class FakeAdapter implements LlmAdapter {
  async *generate(prompt: string, abortSignal?: AbortSignal): AsyncGenerator<string, LlmUsage> {
    const response = this.generateFakeResponse(prompt);
    const chunks = this.splitIntoChunks(response);
    
    let inputTokens = Math.floor(prompt.length / 4); // Rough token estimate
    let outputTokens = 0;
    
    for (const chunk of chunks) {
      if (abortSignal?.aborted) {
        throw new Error('Generation aborted');
      }
      
      // Add delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
      outputTokens += Math.floor(chunk.length / 4);
      yield chunk;
    }
    
    return {
      inputTokens,
      outputTokens
    };
  }
  
  private generateFakeResponse(prompt: string): string {
    const lowercasePrompt = prompt.toLowerCase();
    
    // Basic refusals for unsafe content
    const unsafePatterns = [
      'hack', 'illegal', 'harmful', 'dangerous', 'violence', 'weapon',
      'drug', 'bomb', 'steal', 'fraud', 'scam'
    ];
    
    if (unsafePatterns.some(pattern => lowercasePrompt.includes(pattern))) {
      return "I can't help with requests that could be harmful or illegal. Is there something else I can assist you with?";
    }
    
    // Generate contextual responses
    if (lowercasePrompt.includes('hello') || lowercasePrompt.includes('hi')) {
      return "Hello! I'm a helpful AI assistant. How can I help you today?";
    }
    
    if (lowercasePrompt.includes('weather')) {
      return "I don't have access to real-time weather data, but I'd recommend checking a weather service like Weather.com or your local weather app for current conditions.";
    }
    
    if (lowercasePrompt.includes('code') || lowercasePrompt.includes('program')) {
      return "I'd be happy to help you with coding! Could you provide more details about what programming language or specific problem you're working on?";
    }
    
    if (lowercasePrompt.includes('recipe') || lowercasePrompt.includes('cook')) {
      return "I love helping with cooking! While I can suggest recipes and cooking tips, I'd recommend verifying ingredients and cooking times from reliable sources. What type of dish are you interested in making?";
    }
    
    // Default response
    return "Thank you for your message. I'm a helpful AI assistant designed to provide informative and safe responses. How can I assist you today?";
  }
  
  private splitIntoChunks(text: string): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      if (i === 0) {
        chunks.push(words[i]);
      } else {
        chunks.push(' ' + words[i]);
      }
    }
    
    return chunks;
  }
}