import { BedrockAdapter } from '../adapters/BedrockAdapter';
import { systemPrompt, type AgentKey, TITLE_PROMPT } from '../utils/prompts';
import type { ClaudeMessage, Conversation, Message } from '../types';
import { AgentRouter } from '../routing/agentsRouter';
import { conversationService } from './ConversationService';
import { messageService } from './MessageService';
import { ToolRunner } from './ToolRunnerService';
import { buildDefaultToolRegistry } from '../tools';

const MAX_TURNS = 15; 

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
  onTool?: (tool: { name: string, input: any }) => void;
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
    maxTurns = MAX_TURNS
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    // Pull last N raw messages
    const messages = await messageService.getMessages({
      conversationId,
      userId,
      limit: maxTurns
    });

    // Filter to complete user/assistant only
    let hist = messages
      .filter((m: Message) => m.status === 'complete' && (m.role === 'user' || m.role === 'assistant'))
      .map((m: Message) => ({ role: m.role as 'user' | 'assistant', content: m.content || 'No response from assistant' }));

    // Ensure we start with a user turn
    if (hist.length && hist[0].role === 'assistant') {
      hist = hist.slice(1);
    }

    console.log('[DEBUG] Formatted history for Claude:', JSON.stringify(hist));

    return hist;
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

      // Check if this is the first message in the conversation
      const isFirstMessage = history.length === 1;
      
      console.log(`[DEBUG] Complete message array (${history.length} messages including current):`);
      console.log(JSON.stringify(history, null, 2));

      // Route message to appropriate agent using conversation history
      const agent = await AgentRouter.route({ 
        history: history     
      });

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
        // Build message array for Claude - current user message is already in history
        const messages: ClaudeMessage[] = history;

        // Title generation
        let titlePromise: Promise<string | null> = Promise.resolve(null);
        if (convo.conversationId && isFirstMessage && callbacks.onTitle) {
          titlePromise = generateTitle(input.message).catch((error: any) => {
            console.error('Failed to generate title:', error);
            return null;
          });
        }

        // Use ToolRunner with BedrockAdapter and registry
        const adapter = new BedrockAdapter();
        const registry = buildDefaultToolRegistry();
        const runner = new ToolRunner(adapter, registry);

        // We want to keep SSE feeling live. ToolRunner emits final round text;
        // we chunk it a bit so the client receives multiple 'chunk' events.
        const emitInChunks = (text: string) => {
          const CHUNK = 120;
          for (let i = 0; i < text.length; i += CHUNK) {
            const piece = text.slice(i, i + CHUNK);
            fullAssistant += piece;
            callbacks.onToken(piece);
          }
        };

        const { text: finalText, usage } = await runner.runWithTools(
          messages,
          {
            system: systemPrompt(agent),
            onStreamToken: (t) => emitInChunks(t),
            onToolUse: callbacks.onTool ? (tool) => callbacks.onTool!(tool) : undefined
          }
        );

        // Fallback: if nothing was streamed, stream the finalText now.
        if (!fullAssistant && finalText) {
          emitInChunks(finalText);
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

        // Emit final meta 
        if (callbacks.onMeta) {
          callbacks.onMeta({
            conversationId: convo.conversationId,
            agent,
            model: process.env.MODEL_ID,
            usage
          });
        }

        // Complete
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
