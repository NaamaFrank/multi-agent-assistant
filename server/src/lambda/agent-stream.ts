/// <reference path="../types/awslambda-globals.d.ts" />
import { authenticate } from '../utils/auth';
import { streamingChatService } from '../services/StreamingChatService';

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
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    });

    const heartbeat = setInterval(() => {
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
        const authToken = authHeader || `Bearer ${token}`;
        authResult = await authenticate({ headers: { authorization: authToken } });
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

      await streamingChatService.streamChat(
        {
          message,
          conversationId,
          userId
        },
        {
          onToken: (token: string) => {
            writeSSE(stream, 'chunk', { delta: token });
          },
          onTitle: (title: string) => {
            writeSSE(stream, 'title', { title });
          },
          onMeta: (meta: any) => {
            writeSSE(stream, 'meta', meta);
          },
          onComplete: async (result) => {
            writeSSE(stream, 'meta', {
              conversationId: result.conversationId,
              agent: result.agent,
              userMessageId: result.userMessageId,
              assistantMessageId: result.assistantMessageId
            });
            writeSSE(stream, 'done', { usage: { inputTokens: null, outputTokens: null } });
            stream.end();
          },
          onError: (err: Error) => {
            writeSSE(stream, 'error', { error: String(err) });
            stream.end();
          }
        }
      );
    } catch (err) {
      writeSSE(stream, 'error', { error: `Server error: ${String(err)}` });
      stream.end();
    } finally {
      clearInterval(heartbeat);
    }
  }
);
