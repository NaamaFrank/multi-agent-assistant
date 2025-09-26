// Lambda-native streaming handler using Function URL
import { authenticate } from '../utils/auth';
import { mapError } from '../utils/errors';
import { getConversation, ensureConversation, saveUserMessage, createAssistantMessage, updateAssistantMessage } from '../services/ChatService';

// Function URL event type
interface FunctionUrlEvent {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    requestId: string;
    time: string;
    timeEpoch: number;
  };
  body?: string;
  isBase64Encoded: boolean;
}

// Helper to write SSE events
function writeSSEEvent(type: string, data: any): string {
  const eventData = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  console.log(`wrote ${type}`);
  return eventData;
}

export const handler = async (event: FunctionUrlEvent): Promise<any> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  
  console.log(JSON.stringify({
    requestId,
    rawPath: event.rawPath,
    hasAuthHeader: !!(event.headers?.authorization || event.headers?.Authorization),
    queryParams: event.queryStringParameters
  }));

  // Build SSE response chunks
  let responseChunks: string[] = [];

  try {
    // Authenticate user
    const user = await authenticate(event);

    // Extract parameters
    const message = event.queryStringParameters?.message;
    let conversationId = event.queryStringParameters?.conversationId;

    if (!message) {
      responseChunks.push(writeSSEEvent('error', { message: 'Message parameter is required' }));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        },
        body: responseChunks.join('')
      };
    }

    // Convert string userId to number
    const numericUserId = parseInt(user.id, 10);
    if (isNaN(numericUserId)) {
      responseChunks.push(writeSSEEvent('error', { message: 'Invalid user ID' }));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        },
        body: responseChunks.join('')
      };
    }

    // Ensure conversation exists
    let conversation;
    if (conversationId && conversationId !== 'default') {
      try {
        conversation = await getConversation(conversationId);
        if (!conversation || conversation.userId !== numericUserId) {
          conversation = await ensureConversation(numericUserId);
          conversationId = conversation.conversationId;
        }
      } catch (error) {
        // Create new conversation if not found
        conversation = await ensureConversation(numericUserId);
        conversationId = conversation.conversationId;
      }
    } else {
      conversation = await ensureConversation(numericUserId);
      conversationId = conversation.conversationId;
    }

    // Save user message directly
    const userMessage = await saveUserMessage(conversationId, message);

    // Create assistant message placeholder directly
    const assistantMessage = await createAssistantMessage(conversationId, 'assistant');

    // Write meta event
    responseChunks.push(writeSSEEvent('meta', {
      requestId,
      timestamp: new Date().toISOString(),
      conversationId,
      agent: 'assistant',
      userMessageId: userMessage.messageId,
      assistantMessageId: assistantMessage.messageId
    }));

    // Simulate streaming response by chunking the response
    const responseStart = "I received your message: ";
    const messageWords = message.split(' ');
    let fullResponse = responseStart;

    // Stream the response start
    responseChunks.push(writeSSEEvent('chunk', { delta: responseStart }));
    
    // Stream each word
    for (const word of messageWords) {
      const chunk = word + ' ';
      fullResponse += chunk;
      responseChunks.push(writeSSEEvent('chunk', { delta: chunk }));
    }

    // Update assistant message with full content directly
    await updateAssistantMessage(assistantMessage.messageId, fullResponse, 'complete');

    // Write done event
    responseChunks.push(writeSSEEvent('done', {
      usage: {
        inputTokens: message.length,
        outputTokens: fullResponse.length
      },
      durationMs: 1000
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      },
      body: responseChunks.join('')
    };

  } catch (error: any) {
    console.error(`[${requestId}] Streaming error:`, error);
    const { statusCode, message } = mapError(error);
    
    responseChunks.push(writeSSEEvent('error', {
      statusCode,
      message,
      timestamp: new Date().toISOString()
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      },
      body: responseChunks.join('')
    };
  }
};