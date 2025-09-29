import type { StreamEvent } from '@/types';
import { apiConfig, STORAGE_KEYS } from '@/config';

export class StreamingService {
  /**
   * Stream chat completion using fetch with ReadableStream (like client-v1)
   */
  async *streamChat(
    message: string,
    conversationId?: string,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const token = localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = this.buildStreamingUrl(message, conversationId, token);

    const response = await fetch(url, {
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
                  evt.chunk = payload;
                } else if (eventName === 'title') {
                  evt.title = payload;
                } else if (eventName === 'done') {
                  evt.done = payload;
                } else if (eventName === 'error') {
                  // Server may send { error: "..." } or { message: "..." }
                  const message =
                    (payload && (payload.message || payload.error)) || 'Unknown error';
                  evt.error = { message };
                }

                // Only yield recognized events
                if (evt.meta || evt.chunk || evt.title || evt.done || evt.error) {
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

  private buildStreamingUrl(
    message: string,
    conversationId: string | undefined,
    token: string
  ): string {
    const params = new URLSearchParams();
    params.append('message', message);
    params.append('token', token);
    
    if (conversationId) {
      params.append('conversationId', conversationId);
    }

    return `${apiConfig.streamingUrl}?${params.toString()}`;
  }

  /**
   * Stop current streaming session
   */
  stop(): void {
    // This method is kept for compatibility but not needed for fetch-based streaming
    // The AbortController signal passed to streamChat handles cancellation
  }
}

// Export singleton instance
export const streamingService = new StreamingService();