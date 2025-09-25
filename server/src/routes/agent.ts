import { Router, Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { streamValidation, handleValidationErrors } from '../middleware/streamValidation';
import { ChatService } from '../services/ChatService';
import { GeneralAgent } from '../agents/GeneralAgent';
import { createLlmAdapter } from '../adapters';
import { MemoryConversationsRepo, MemoryMessagesRepo } from '../repositories';
import { ApiResponse, StreamEvents } from '../types';

const router = Router();

// Initialize repositories and services
const conversationsRepo = new MemoryConversationsRepo();
const messagesRepo = new MemoryMessagesRepo();
const chatService = new ChatService(conversationsRepo, messagesRepo);
const llmAdapter = createLlmAdapter();
const generalAgent = new GeneralAgent(llmAdapter);

// Streaming endpoint
router.get('/stream', 
  auth, 
  streamValidation, 
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const userId = req.user!.userId;
    const message = req.query.message as string;
    const conversationId = req.query.conversationId as string | undefined;
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity'
    });
    
    let assistantMessageId = '';
    let userMessageId = '';
    let finalConversationId = conversationId || '';
    
    const abortController = new AbortController();
    const heartbeatMs = parseInt(process.env.STREAM_HEARTBEAT_MS || '15000');
    const idleTimeoutMs = parseInt(process.env.STREAM_IDLE_TIMEOUT_MS || '60000');
    
    let heartbeatInterval: NodeJS.Timeout;
    let idleTimeout: NodeJS.Timeout;
    let lastActivity = Date.now();
    
    // Heartbeat to keep connection alive
    const startHeartbeat = () => {
      heartbeatInterval = setInterval(() => {
        res.write(':\n\n'); // SSE comment for heartbeat
      }, heartbeatMs);
    };
    
    // Idle timeout
    const resetIdleTimeout = () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        abortController.abort();
        writeError('Stream idle timeout exceeded');
      }, idleTimeoutMs);
    };
    
    const writeEvent = (event: string, data: any) => {
      lastActivity = Date.now();
      resetIdleTimeout();
      res.write(`data: ${JSON.stringify({ [event]: data })}\n\n`);
    };
    
    const writeError = (message: string) => {
      writeEvent('error', { message });
      cleanup();
    };
    
    const cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (idleTimeout) clearTimeout(idleTimeout);
      res.end();
    };
    
    // Handle client disconnect
    req.on('close', async () => {
      abortController.abort();
      if (assistantMessageId) {
        await chatService.updateAssistantMessage(assistantMessageId, '', 'interrupted');
      }
      cleanup();
    });
    
    try {
      startHeartbeat();
      resetIdleTimeout();
      
      // Ensure conversation exists
      const conversation = await chatService.ensureConversation(userId, conversationId);
      finalConversationId = conversation.conversationId;
      
      // Save user message
      const userMessage = await chatService.saveUserMessage(finalConversationId, message);
      userMessageId = userMessage.messageId;
      
      // Create assistant message
      const assistantMessage = await chatService.createAssistantMessage(finalConversationId, 'general');
      assistantMessageId = assistantMessage.messageId;
      
      // Emit meta event
      writeEvent('meta', {
        conversationId: finalConversationId,
        agent: 'general',
        userMessageId,
        assistantMessageId
      });
      
      // Get conversation history
      const history = await chatService.getConversationHistory(finalConversationId, 5);
      
      // Generate response
      let fullResponse = '';
      const generator = generalAgent.generate({
        user: { userId },
        conversationId: finalConversationId,
        message,
        history,
        abortSignal: abortController.signal
      });
      
      for await (const chunk of generator) {
        if (abortController.signal.aborted) {
          break;
        }
        
        fullResponse += chunk;
        writeEvent('chunk', { delta: chunk });
      }
      
      if (!abortController.signal.aborted) {
        // Update assistant message with full response
        await chatService.updateAssistantMessage(assistantMessageId, fullResponse, 'complete');
        await chatService.updateConversationLastMessageAt(finalConversationId);
        
        // Emit done event
        const durationMs = Date.now() - startTime;
        writeEvent('done', {
          usage: {
            inputTokens: Math.floor(message.length / 4), // Rough estimate
            outputTokens: Math.floor(fullResponse.length / 4)
          },
          durationMs
        });
      }
      
      cleanup();
      
    } catch (error) {
      console.error('Stream error:', error);
      
      if (assistantMessageId) {
        await chatService.updateAssistantMessage(assistantMessageId, '', 'error');
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      writeError(errorMessage);
    }
  }
);

// Non-stream endpoints for future UI
router.post('/conversations', auth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversation = await chatService.ensureConversation(userId);
    
    const response: ApiResponse<{ conversationId: string }> = {
      success: true,
      message: 'Conversation created',
      data: { conversationId: conversation.conversationId }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Create conversation error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to create conversation'
    };
    res.status(500).json(response);
  }
});

router.get('/conversations/:id', auth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    
    const conversation = await chatService.getConversation(conversationId);
    
    if (!conversation || conversation.userId !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Conversation not found'
      };
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Conversation found',
      data: conversation
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get conversation error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to get conversation'
    };
    res.status(500).json(response);
  }
});

router.get('/conversations/:id/messages', auth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const before = req.query.before ? new Date(req.query.before as string) : undefined;
    
    const conversation = await chatService.getConversation(conversationId);
    
    if (!conversation || conversation.userId !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Conversation not found'
      };
      res.status(404).json(response);
      return;
    }
    
    const messages = await chatService.getConversationMessages(conversationId, { limit, before });
    
    const response: ApiResponse = {
      success: true,
      message: 'Messages retrieved',
      data: messages
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get messages error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to get messages'
    };
    res.status(500).json(response);
  }
});

export default router;