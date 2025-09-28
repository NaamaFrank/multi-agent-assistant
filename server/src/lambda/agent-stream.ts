/// <reference path="../types/awslambda-globals.d.ts" />

import { authenticate } from '../utils/auth';
import {
  ensureConversation,
  saveUserMessage,
  createAssistantMessageWithContent,
  getConversationHistory
} from '../services/ChatService';
import { streamChatCompletion } from '../services/StreamingService';

interface FunctionUrlEvent {
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  httpMethod?: string;
  requestContext?: { requestId?: string; http?: { method?: string; path?: string } };
}

export const handler = async (event: FunctionUrlEvent, context: any) => {
  
  try {
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
    
    // Handle OPTIONS request
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: ''
      };
    }

    // Get request parameters
    const message = event.queryStringParameters?.message?.trim();
    const conversationId = event.queryStringParameters?.conversationId;
    const authHeader = event.headers?.['Authorization'] || event.headers?.['authorization'];
    
    console.log('Request params:', { 
      message: message ? message.substring(0, 100) : undefined,
      conversationId, 
      hasAuth: !!authHeader 
    });

    if (!message) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: 'event: error\ndata: {"error": "Message parameter is required"}\n\n'
      };
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
      console.log('Authentication successful, userId:', userId);
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: `event: error\ndata: {"error": "Authentication failed: ${String(error)}"}\n\n`
      };
    }

    // Build SSE response
    let sseResponse = '';
    
    // Send initial meta information
    sseResponse += 'event: meta\n';
    sseResponse += `data: {"conversationId": "", "agent": "claude-3-haiku", "userMessageId": "", "assistantMessageId": ""}\n\n`;

    // Ensure conversation exists
    console.log('Creating/getting conversation...');
    const conversation = await ensureConversation(userId, conversationId);
    console.log('Conversation ready:', conversation.conversationId);
    
    // Save user message
    console.log('Saving user message...');
    const userMessage = await saveUserMessage(conversation.conversationId, message);
    console.log('User message saved');


    // Get conversation history for context (excluding the current user message we just saved)
    console.log('Getting conversation history...');
    const fullHistory = await getConversationHistory(conversation.conversationId);
    console.log('Full history retrieved, length:', fullHistory.length);
    
    // Remove the last user message if it exists (since we'll add it again in streamChatCompletion)
    const history = fullHistory.length > 0 && fullHistory[fullHistory.length - 1].role === 'user' 
      ? fullHistory.slice(0, -1) 
      : fullHistory;
    console.log('History for Bedrock, length:', history.length);

    // Get AI response first, then create assistant message with complete content
    console.log('Starting AI response generation...');
    
    let fullAssistantResponse = '';
    const responseTokens: string[] = [];

    // Use a promise to collect streaming tokens
    await new Promise<void>((resolve, reject) => {
      // Pass the user message - streamChatCompletion will add it to the history
      streamChatCompletion(message, {
        onToken: (token: string) => {
          fullAssistantResponse += token;
          responseTokens.push(token);
        },
        onComplete: async () => {
          try {
            console.log('AI response complete, response length:', fullAssistantResponse.length);
            resolve();
          } catch (error) {
            console.error('Error completing response:', error);
            reject(error);
          }
        },
        onError: (error: Error) => {
          console.error('AI response error:', error);
          reject(error);
        }
      }, history);
    });

    // Now create assistant message with the complete content directly
    console.log('Creating assistant message with complete content...');
    const assistantMessage = await createAssistantMessageWithContent(conversation.conversationId, 'claude-3-haiku', fullAssistantResponse);
    console.log('Assistant message created with content:', assistantMessage.messageId);

    // Send updated meta information
    sseResponse += 'event: meta\n';
    sseResponse += `data: {"conversationId": "${conversation.conversationId}", "agent": "claude-3-haiku", "userMessageId": "${userMessage.messageId}", "assistantMessageId": "${assistantMessage.messageId}"}\n\n`;

    // Add all tokens as chunks to SSE response
    for (const token of responseTokens) {
      sseResponse += 'event: chunk\n';
      sseResponse += `data: {"delta": ${JSON.stringify(token)}}\n\n`;
    }
    
    // Send completion event
    sseResponse += 'event: done\n';
    sseResponse += `data: {"usage": {"inputTokens": null, "outputTokens": null}, "durationMs": 0}\n\n`;

    console.log('Pseudo-streaming response complete');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      body: sseResponse
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      body: `event: error\ndata: {"error": "Server error: ${String(error)}"}\n\n`
    };
  }
};