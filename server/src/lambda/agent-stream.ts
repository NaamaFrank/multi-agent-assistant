/// <reference path="../types/awslambda-globals.d.ts" />

import { authenticate } from '../utils/auth';
import {
  ensureConversation,
  saveUserMessage,
  createAssistantMessageWithContent,
  getConversationHistory
} from '../services/ChatService';
import { streamChatCompletion } from '../services/StreamingService';
import type { AgentKey } from '../utils/prompts';
import { AgentRouter } from '../routing/agentsRouter';

interface FunctionUrlEvent {
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  httpMethod?: string;
  requestContext?: { requestId?: string; http?: { method?: string; path?: string } };
}

function writeSSE(stream: any, event: string, data: any) {
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}

export const handler = awslambda.streamifyResponse(
  async (event: FunctionUrlEvent, responseStream: any, _context: any) => {
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

    // Preflight
    if (method === 'OPTIONS') {
      const resp = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          // 'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      });
      resp.end();
      return;
    }

    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        // Critical for SSE
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        // Helps avoid proxy buffering in some stacks
        'X-Accel-Buffering': 'no',
        // CORS
        // 'Access-Control-Allow-Origin': '*',
        // 'Access-Control-Allow-Headers': 'authorization, content-type',
        // 'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    });

    const heartbeat = setInterval(() => {
      // Comment lines are valid SSE keep-alives
      stream.write(`: ping\n\n`);
    }, 15000);

    try {
      const message = event.queryStringParameters?.message?.trim();
      const conversationId = event.queryStringParameters?.conversationId;
      const token = event.queryStringParameters?.token;
      const authHeader = event.headers?.['Authorization'] || event.headers?.['authorization'];

      if (!message) {
        writeSSE(stream, 'error', { message: 'Message parameter is required' });
        stream.end();
        return;
      }

      if (!authHeader && !token) {
        writeSSE(stream, 'error', { error: 'Authentication required' });
        stream.end();
        return;
      }

      // Try authentication with either header or token parameter
      let authResult: any;
      try {
        if (authHeader) {
          authResult = await authenticate({ headers: { authorization: authHeader } });
        } else if (token) {
          authResult = await authenticate({ headers: { authorization: `Bearer ${token}` } });
        }
      } catch (error) {
        writeSSE(stream, 'error', { error: `Authentication failed: ${error}` });
        stream.end();
        return;
      }

      const userId = parseInt(authResult.id);
      if (isNaN(userId)) {
        writeSSE(stream, 'error', { error: 'Invalid user ID' });
        stream.end();
        return;
      }

      const convo = await ensureConversation(userId, conversationId);
      const userMsg = await saveUserMessage(convo.conversationId, message);

      // Load prior history (we’ll append the new user msg in streamChatCompletion)
      const fullHistory = await getConversationHistory(convo.conversationId);
      const history =
        fullHistory.length > 0 && fullHistory[fullHistory.length - 1].role === 'user'
          ? fullHistory.slice(0, -1)
          : fullHistory;

      const agent: AgentKey = AgentRouter.route({
        message,
        path: event.requestContext?.http?.path,
        query: event.queryStringParameters as any,
        headers: {
          authorization: event.headers?.authorization || event.headers?.Authorization || '',
        },
      });

      // Send meta ASAP so the UI can prep
      writeSSE(stream, 'meta', {
        conversationId: convo.conversationId,
        agent: agent,                 
        model: 'claude-3-5-haiku',    
        userMessageId: userMsg.messageId,
        assistantMessageId: ''
      });
      writeSSE(stream, 'chunk', { delta: '' });  // harmless; triggers the UI tick


      let fullAssistant = '';

      await streamChatCompletion(
        message,
        {
          onToken: (token: string) => {
            fullAssistant += token;
            writeSSE(stream, 'chunk', { delta: token });
          },
          onComplete: async () => {
            const assistantMsg = await createAssistantMessageWithContent(
              convo.conversationId,
              'claude-3-5-haiku',
              fullAssistant
            );
            // Send final meta w/ assistant id (optional)
            writeSSE(stream, 'meta', {
              conversationId: convo.conversationId,
              agent: 'claude-3-5-haiku',
              userMessageId: userMsg.messageId,
              assistantMessageId: assistantMsg.messageId
            });
            writeSSE(stream, 'done', { usage: { inputTokens: null, outputTokens: null } });
            stream.end();
          },
          onError: (err: Error) => {
            writeSSE(stream, 'error', { error: String(err) });
            stream.end();
          }
        },
        history,
        agent
      );
    } catch (err) {
      writeSSE(stream, 'error', { error: `Server error: ${String(err)}` });
      stream.end();
    } finally {
      clearInterval(heartbeat);
    }
  }
);
