import { ConversationsRepo } from '../repositories';
import { getConversationsRepo } from '../repositories/factory';
import { BedrockAdapter } from '../adapters/BedrockAdapter';
import { systemPrompt, type AgentKey, TITLE_PROMPT } from '../utils/prompts';
import type { ClaudeMessage } from '../types';
import { AgentRouter } from '../routing/agentsRouter';
import { ensureConversation, saveUserMessage, createAssistantMessageWithContent, getConversationHistory } from './ChatService';

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
  constructor(
    private conversationsRepo: ConversationsRepo = getConversationsRepo()
  ) {}

  async streamChat(input: StreamingChatInput, callbacks: StreamingChatCallbacks): Promise<void> {
    try {
      // Ensure conversation exists
      const convo = await ensureConversation(input.userId, input.conversationId);
      
      // Save user message
      const userMsg = await saveUserMessage(convo.conversationId, input.message);
      
      // Get conversation history for context 
      const history = await getConversationHistory(convo.conversationId);
      
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
        const assistantMsg = await createAssistantMessageWithContent(
          convo.conversationId,
          agent,
          fullAssistant
        );

        // Update conversation title in database if one was generated
        if (titleFromStreaming && isFirstMessage) {
          try {
            await this.conversationsRepo.updateMeta(convo.conversationId, { 
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