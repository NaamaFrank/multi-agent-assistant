import { Request, Response } from 'express';
import * as chatService from '../services/ChatService';
import { GeneralAgent } from '../agents/GeneralAgent';
import { createLlmAdapter } from '../adapters';
import { ApiResponse } from '../types';

// Initialize shared services (using default repository instances from ChatService)
const llmAdapter = createLlmAdapter();
const generalAgent = new GeneralAgent(llmAdapter);

export const streamChat = async (req: Request, res: Response): Promise<void> => {
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
  let isCompleted = false; // Track if streaming completed successfully
  
  const abortController = new AbortController();
  const heartbeatMs = parseInt(process.env.STREAM_HEARTBEAT_MS || '15000');
  const idleTimeoutMs = parseInt(process.env.STREAM_IDLE_TIMEOUT_MS || '60000');
  
  let heartbeatInterval: NodeJS.Timeout;
  let idleTimeout: NodeJS.Timeout;
  let lastActivity = Date.now();

  const cleanup = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (idleTimeout) clearTimeout(idleTimeout);
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
    res.end();
  };

  // Handle client disconnect
  req.on('close', () => {
    console.log('Client disconnected from stream');
    cleanup();
  });

  // Handle server abort
  abortController.signal.addEventListener('abort', () => {
    console.log('Stream aborted');
    cleanup();
  });

  const resetIdleTimeout = () => {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      console.log('Stream idle timeout reached');
      cleanup();
    }, idleTimeoutMs);
  };

  const sendEvent = (event: string, data: any) => {
    if (abortController.signal.aborted || !res.writable) return;
    
    lastActivity = Date.now();
    resetIdleTimeout();
    
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const sendHeartbeat = () => {
    if (Date.now() - lastActivity >= heartbeatMs * 0.8) {
      res.write(':\n\n'); // SSE comment for heartbeat
    }
  };

  try {
    // Initialize heartbeat and idle timeout
    heartbeatInterval = setInterval(sendHeartbeat, heartbeatMs);
    resetIdleTimeout();

    // Create or get conversation (using default repositories)
    const conversation = await chatService.ensureConversation(userId, conversationId);
    finalConversationId = conversation.conversationId;

    // Save user message
    const userMessage = await chatService.saveUserMessage(finalConversationId, message);
    userMessageId = userMessage.messageId;

    // Create assistant message
    const assistantMessage = await chatService.createAssistantMessage(finalConversationId, 'general');
    assistantMessageId = assistantMessage.messageId;

    // Emit meta event
    sendEvent('meta', {
      conversationId: finalConversationId,
      agent: 'general',
      userMessageId,
      assistantMessageId
    });

    // Get conversation history for context
    const history = await chatService.getConversationHistory(finalConversationId, 5);

    // Stream response from agent
    let fullResponse = '';
    const generator = generalAgent.generate({
      user: { userId },
      conversationId: finalConversationId,
      message,
      history,
      abortSignal: abortController.signal
    });

    for await (const chunk of generator) {
      if (abortController.signal.aborted) break;
      
      fullResponse += chunk;
      sendEvent('chunk', { delta: chunk });
    }

    if (!abortController.signal.aborted) {
      // Update the assistant message with final content
      await chatService.updateAssistantMessage(assistantMessageId, fullResponse, 'complete');
      await chatService.updateConversationLastMessageAt(finalConversationId);
      isCompleted = true; // Mark as completed successfully

      // Emit done event
      const durationMs = Date.now() - startTime;
      sendEvent('done', {
        usage: {
          inputTokens: Math.floor(message.length / 4),
          outputTokens: Math.floor(fullResponse.length / 4)
        },
        durationMs
      });
    }

  } catch (error: any) {
    console.error('Streaming error:', error);
    
    sendEvent('error', {
      message: error.message
    });

    // If we have an assistant message that was started but not completed, mark it as interrupted
    if (assistantMessageId && !isCompleted) {
      try {
        await chatService.updateAssistantMessage(assistantMessageId, '', 'interrupted');
      } catch (updateError) {
        console.error('Failed to update interrupted message:', updateError);
      }
    }
  } finally {
    cleanup();
  }
};

export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const conversation = await chatService.ensureConversation(userId);
    
    const response: ApiResponse<{ conversationId: string }> = {
      success: true,
      message: 'Conversation created successfully',
      data: { conversationId: conversation.conversationId }
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Create conversation error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to create conversation'
    };
    res.status(500).json(response);
  }
};

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const conversations = await chatService.getUserConversations(userId);
    
    const response: ApiResponse<any> = {
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message
    };
    res.status(500).json(response);
  }
};

export const getConversationById = async (req: Request, res: Response): Promise<void> => {
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
    
    const response: ApiResponse<any> = {
      success: true,
      message: 'Conversation retrieved successfully',
      data: conversation
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message
    };
    res.status(500).json(response);
  }
};

export const getConversationMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    
    // Verify user has access to this conversation
    const conversation = await chatService.getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Conversation not found'
      };
      res.status(404).json(response);
      return;
    }
    
    const messages = await chatService.getConversationMessages(conversationId);
    
    const response: ApiResponse<any> = {
      success: true,
      message: 'Messages retrieved successfully',
      data: messages
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message
    };
    res.status(500).json(response);
  }
};