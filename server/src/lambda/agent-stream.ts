/// <reference path="../types/awslambda-globals.d.ts" />

import { authenticate } from '../utils/auth';
import { mapError } from '../utils/errors';
import {
  getConversation,
  ensureConversation,
  saveUserMessage,
  createAssistantMessage,
  updateAssistantMessage,
  getConversationHistory
} from '../services/ChatService';
import { streamChatCompletion } from '../services/StreamingService';

interface FunctionUrlEvent {
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  httpMethod?: string;
  requestContext?: { requestId?: string; http?: { method?: string; path?: string } };
}

// *** WORKING STREAMING VERSION ***
// CORS headers are handled by AWS Lambda Function URL configuration - no need to add them manually

export const handler = awslambda.streamifyResponse(
  async (event: FunctionUrlEvent, responseStream: any, context: any) => {
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
    
    console.log(`Processing ${method} request in streamifyResponse handler`);

    try {
      // Initialize response stream with proper headers (no CORS - handled by Function URL)
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          'Content-Type': method === 'OPTIONS' ? 'text/plain' : 'text/event-stream',
          'Cache-Control': method === 'OPTIONS' ? 'max-age=86400' : 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        }
      });

      // Handle OPTIONS request
      if (method === 'OPTIONS') {
        console.log('Handling OPTIONS request within streamifyResponse');
        responseStream.end(); // No body for OPTIONS
        return;
      }

      // Handle streaming request
      const message = event.queryStringParameters?.message;
      const conversationId = event.queryStringParameters?.conversationId;
      const authHeader = event.headers?.authorization;

      console.log('Stream request params:', { message, conversationId, hasAuth: !!authHeader });

      // Validate required parameters
      if (!message) {
        responseStream.write('event: error\n');
        responseStream.write('data: {"error": "Message parameter is required"}\n\n');
        responseStream.end();
        return;
      }

      // Authenticate user
      let userId: number;
      try {
        if (!authHeader) {
          throw new Error('Authentication required');
        }
        const authResult = await authenticate({ headers: { authorization: authHeader } });
        userId = parseInt(authResult.id);
        if (isNaN(userId)) {
          throw new Error('Invalid user ID');
        }
        console.log('Streaming authentication successful, userId:', userId);
      } catch (error) {
        console.error('Streaming authentication error:', error);
        responseStream.write('event: error\n');
        responseStream.write(`data: {"error": "Authentication failed: ${String(error)}"}\n\n`);
        responseStream.end();
        return;
      }

      // Send initial connection confirmation
      responseStream.write('event: connected\n');
      responseStream.write(`data: {"status": "streaming_started", "userId": ${userId}}\n\n`);

      // Send an immediate test event to confirm streaming works
      responseStream.write('event: test\n');
      responseStream.write('data: {"message": "Immediate test - streaming infrastructure working"}\n\n');

      // Ensure conversation exists
      console.log('Creating/getting conversation...');
      const conversation = await ensureConversation(userId, conversationId);
      console.log('Conversation ready:', conversation.conversationId);
      
      // Save user message
      console.log('Saving user message...');
      const userMessage = await saveUserMessage(conversation.conversationId, message);
      console.log('User message saved');

      // Send progress update
      responseStream.write('event: progress\n');
      responseStream.write('data: {"message": "Conversation ready, starting AI response..."}\n\n');

      // Get conversation history for context
      console.log('Getting conversation history...');
      const history = await getConversationHistory(conversation.conversationId);
      console.log('History retrieved, length:', history.length);

      // Create assistant message placeholder
      console.log('Creating assistant message placeholder...');
      const assistantMessage = await createAssistantMessage(conversation.conversationId, 'claude-3-sonnet');
      console.log('Assistant message created:', assistantMessage.messageId);

      // Send conversation ready event
      responseStream.write('event: ready\n');
      responseStream.write(`data: {"conversationId": "${conversation.conversationId}", "messageId": "${assistantMessage.messageId}"}\n\n`);

      let fullAssistantResponse = '';

      // Start streaming with AWS Bedrock
      console.log('Starting Bedrock streaming...');
      await streamChatCompletion(message, {
        onToken: (token: string) => {
          fullAssistantResponse += token;
          // Send token as SSE event
          responseStream.write('event: token\n');
          responseStream.write(`data: {"token": ${JSON.stringify(token)}}\n\n`);
        },
        onComplete: async () => {
          try {
            console.log('Streaming complete, updating assistant message...');
            // Update the assistant message with complete response
            await updateAssistantMessage(assistantMessage.messageId, fullAssistantResponse, 'complete');
            
            // Send completion event
            responseStream.write('event: complete\n');
            responseStream.write(`data: {"message": "Stream completed", "conversationId": "${conversation.conversationId}", "messageId": "${assistantMessage.messageId}", "fullResponse": ${JSON.stringify(fullAssistantResponse)}}\n\n`);
            responseStream.end();
            console.log('Stream completed successfully');
          } catch (error) {
            console.error('Error completing stream:', error);
            responseStream.write('event: error\n');
            responseStream.write(`data: {"error": "Failed to save response: ${String(error)}"}\n\n`);
            responseStream.end();
          }
        },
        onError: (error: Error) => {
          console.error('Bedrock streaming error:', error);
          responseStream.write('event: error\n');
          responseStream.write(`data: {"error": "Streaming failed: ${String(error)}"}\n\n`);
          responseStream.end();
        }
      }, history);

    } catch (error) {
      console.error('Handler error:', error);
      try {
        responseStream.write('event: error\n');
        responseStream.write(`data: {"error": "Server error: ${String(error)}"}\n\n`);
        responseStream.end();
      } catch (writeError) {
        console.error('Failed to write error to stream:', writeError);
      }
    }
  }
);