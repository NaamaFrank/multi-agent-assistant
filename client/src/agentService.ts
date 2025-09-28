import { getApiConfig } from './config/api';

export interface StreamEvent {
  meta?: {
    conversationId: string;
    agent: string;
    userMessageId: string;
    assistantMessageId: string;
    model?: string;
  };
  chunk?: {
    delta: string;
  };
  done?: {
    usage: {
      inputTokens: number | null;
      outputTokens: number | null;
    };
    durationMs: number;
  };
  error?: {
    message: string;
  };
}

export interface Conversation {
  conversationId: string;
  userId: number;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  ts: string;
  role: 'user' | 'assistant' | 'tool';
  agent?: string;
  content: string;
  status: 'complete' | 'interrupted' | 'error';
}

class AgentService {
  private baseUrl = getApiConfig().AGENT_BASE_URL;

  /**
   * Stream chat via SSE over fetch(). No Authorization header (token is in querystring).
   */
  async *streamChat(
    message: string,
    conversationId?: string,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Dedicated streaming URL (Lambda Function URL)
    const url = getApiConfig().STREAMING_URL;

    // Build full URL with query params
    let streamUrl: string;
    if (url.startsWith('http')) {
      const urlWithParams = new URL(url);
      urlWithParams.searchParams.append('message', message);
      urlWithParams.searchParams.append('token', token); // auth via query
      if (conversationId) urlWithParams.searchParams.append('conversationId', conversationId);
      streamUrl = urlWithParams.toString();
    } else {
      const params = new URLSearchParams();
      params.append('message', message);
      params.append('token', token);
      if (conversationId) params.append('conversationId', conversationId);
      streamUrl = `${url}?${params.toString()}`;
    }

    const response = await fetch(streamUrl, {
        credentials: 'omit',
        signal
        });

    if (!response.ok) {
      // Try to read JSON error if present
      let msg = 'Stream request failed';
      try {
        const errorData = await response.json();
        msg = errorData.message || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();

    // Robust SSE parsing: handles CRLF, multi-line data blocks, and event boundaries
    let buffer = '';
    let eventName = '';
    let dataBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on LF, keep trailing partial in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (let raw of lines) {
          // Strip trailing CR (from CRLF)
          const line = raw.replace(/\r$/, '');

          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            // Accumulate data lines until blank separator
            // Keep the newline; we'll trim at dispatch
            dataBuffer += line.slice(5).trimStart() + '\n';
          } else if (line.startsWith(':')) {
            // Comment/heartbeat line -> ignore
            continue;
          } else if (line === '') {
            // Blank line -> dispatch one event
            if (dataBuffer) {
              const json = dataBuffer.trimEnd();
              try {
                const payload = JSON.parse(json);
                const evt: StreamEvent = {};

                if (eventName === 'meta') {
                  evt.meta = payload;
                } else if (eventName === 'chunk') {
                  // { delta: "..." }
                  evt.chunk = payload;
                } else if (eventName === 'done') {
                  evt.done = payload;
                } else if (eventName === 'error') {
                  // Server may send { error: "..." } or { message: "..." }
                  const message =
                    (payload && (payload.message || payload.error)) || 'Unknown error';
                  evt.error = { message };
                }

                // Only yield recognized events
                if (evt.meta || evt.chunk || evt.done || evt.error) {
                  yield evt;
                }
              } catch (e) {
                console.warn('SSE JSON parse failed:', json);
              }
            }

            // Reset for next event
            eventName = '';
            dataBuffer = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async createConversation(): Promise<{ conversationId: string }> {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create conversation');
    }

    return data.data;
  }

  async getConversations() {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get conversations');
    }

    return { success: true, data: data.data };
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get conversation');
    }

    return data.data;
  }

  async getConversationMessages(conversationId: string, limit?: number) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    let url = `${this.baseUrl}/conversations/${conversationId}/messages`;
    if (limit) url += `?limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get messages');
    }

    return { success: true, data: data.data };
  }

  async deleteConversation(conversationId: string) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete conversation');
    }

    return data;
  }
}

export const agentService = new AgentService();
