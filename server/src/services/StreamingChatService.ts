import { BedrockAdapter } from '../adapters/BedrockAdapter';
import { systemPrompt, type AgentKey, TITLE_PROMPT } from '../utils/prompts';
import type { ClaudeMessage, Conversation, Message } from '../types';
import { AgentRouter } from '../routing/agentsRouter';
import { conversationService } from './ConversationService';
import { messageService } from './MessageService';

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

export interface StreamingChatInput {
  message: string;
  conversationId?: string;
  userId: number;
}

export interface StreamingChatCallbacks {
  onToken: (token: string) => void;
  onTitle?: (title: string) => void;
  onMeta?: (meta: any) => void;
  onComplete: (result: StreamingChatResult) => Promise<void>;
  onError: (error: Error) => void;
}

export interface StreamingChatResult {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  agent: AgentKey;
  generatedTitle?: string;
}

export interface IStreamingChatService {
  streamChat(input: StreamingChatInput, callbacks: StreamingChatCallbacks): Promise<void>;
}

export class StreamingChatServiceImpl implements IStreamingChatService {


  private async ensureConversation(userId: number, conversationId?: string): Promise<Conversation> {
    if (conversationId) {
      const existing = await conversationService.getConversationById(conversationId, userId);
      if (existing) {
        return existing;
      }
      throw new Error('Conversation not found or access denied');
    }
    
    return conversationService.createConversation(userId);
  }

  private async getConversationHistory(
    conversationId: string,
    userId: number,
    limit = 10
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await messageService.getMessages({
      conversationId,
      userId,
      limit
    });
    
    return messages
      .filter((msg: Message) => msg.status === 'complete' && (msg.role === 'user' || msg.role === 'assistant'))
      .map((msg: Message) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  async streamChat(input: StreamingChatInput, callbacks: StreamingChatCallbacks): Promise<void> {
    try {
      // Ensure conversation exists
      const convo = await this.ensureConversation(input.userId, input.conversationId);
      
      // Save user message
      const userMsg = await messageService.addMessage({
        conversationId: convo.conversationId,
        userId: input.userId,
        role: 'user',
        content: input.message
      });

      // Get conversation history for context
      const history = await this.getConversationHistory(convo.conversationId, input.userId);

      // Get conversation history to check if this is the first message
      const isFirstMessage = history.length === 1;

      // Route message to appropriate agent
      const agent = await AgentRouter.route({ message: input.message });

      // Send initial meta event
      if (callbacks.onMeta) {
        callbacks.onMeta({
          conversationId: convo.conversationId,
          agent: agent,
          model: process.env.MODEL_ID,
          userMessageId: userMsg.messageId,
          assistantMessageId: '' // Will be filled later
        });
      }

      let fullAssistant = '';
      let generatedTitle: string | undefined;

      // Stream AI response directly with Bedrock
      try {
        // Build message array for Claude
        const messages: ClaudeMessage[] = [
          ...history.slice(-5),
          { role: 'user', content: input.message }
        ];

        const adapter = new BedrockAdapter();
        const gen = adapter.generate(messages, /* abortSignal */ undefined, systemPrompt(agent));

        // Generate title if this is the first message
        let titlePromise: Promise<string | null> = Promise.resolve(null);
        
        if (convo.conversationId && isFirstMessage && callbacks.onTitle) {
          titlePromise = generateTitle(input.message).catch((error: any) => {
            console.error('Failed to generate title:', error);
            return null;
          });
        }

        // Stream AI response tokens
        for await (const token of gen) {
          fullAssistant += token;
          callbacks.onToken(token);
        }
        
        // Handle title after response completes
        let titleFromStreaming: string | null = null;
        if (convo.conversationId && isFirstMessage && callbacks.onTitle) {
          try {
            titleFromStreaming = await titlePromise;
            if (titleFromStreaming) {
              callbacks.onTitle(titleFromStreaming);
              generatedTitle = titleFromStreaming;
            }
          } catch (titleError) {
            console.error('Failed to generate title:', titleError);
          }
        }

        // Save the assistant message
        const assistantMsg = await messageService.addMessage({
          conversationId: convo.conversationId,
          userId: input.userId,
          content: fullAssistant,
          role: 'assistant',
          agent
        });

        // Update conversation title in database if one was generated
        if (titleFromStreaming && isFirstMessage) {
          try {
            await conversationService.updateConversation(convo.conversationId, convo.userId, { 
              title: titleFromStreaming 
            });
          } catch (titleError) {
            console.error('Failed to save title to database:', titleError);
          }
        }

        // Call the completion callback with all results
        await callbacks.onComplete({
          conversationId: convo.conversationId,
          userMessageId: userMsg.messageId,
          assistantMessageId: assistantMsg.messageId,
          agent,
          generatedTitle
        });

      } catch (streamingError) {
        callbacks.onError(streamingError as Error);
        return;
      }

    } catch (error) {
      callbacks.onError(error as Error);
    }
  }
}

// Export singleton instance
export const streamingChatService = new StreamingChatServiceImpl();