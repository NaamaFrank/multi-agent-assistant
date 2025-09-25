export interface StreamEvent {
  meta?: {
    conversationId: string;
    agent: string;
    userMessageId: string;
    assistantMessageId: string;
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
  private baseUrl = 'http://localhost:3002/api/agent';

  async *streamChat(message: string, conversationId?: string, signal?: AbortSignal): AsyncGenerator<StreamEvent, void, unknown> {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = `${this.baseUrl}/stream`;
    const urlWithParams = new URL(url);
    urlWithParams.searchParams.append('message', message);
    if (conversationId) {
      urlWithParams.searchParams.append('conversationId', conversationId);
    }

    const response = await fetch(urlWithParams.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      signal
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Create proper StreamEvent based on event type
              let streamEvent: StreamEvent = {};
              
              if (currentEvent === 'meta') {
                streamEvent.meta = data;
              } else if (currentEvent === 'chunk') {
                streamEvent.chunk = data;
              } else if (currentEvent === 'done') {
                streamEvent.done = data;
              } else if (currentEvent === 'error') {
                streamEvent.error = data;
              }
              
              yield streamEvent;
              currentEvent = ''; // Reset event type
            } catch (e) {
              console.warn('Failed to parse SSE data:', line);
            }
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
    if (limit) {
      url += `?limit=${limit}`;
    }

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
}

export const agentService = new AgentService();