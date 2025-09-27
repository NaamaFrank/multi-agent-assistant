import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

export interface StreamingOptions {
  onToken: (token: string) => void;
  onComplete: () => Promise<void>;
  onError: (error: Error) => void;
}

export const streamChatCompletion = async (
  userMessage: string, 
  options: StreamingOptions,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<void> => {
  try {
    // Build messages array for Claude
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage }
    ];

    // Claude 3 Sonnet model parameters
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4000,
      messages: messages,
      temperature: 0.7,
      stream: true
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrock.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    let fullContent = '';

    // Process the streaming response
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
        
        if (chunkData.type === 'content_block_delta') {
          const token = chunkData.delta?.text || '';
          if (token) {
            fullContent += token;
            options.onToken(token);
          }
        } else if (chunkData.type === 'message_stop') {
          // Stream is complete
          await options.onComplete();
          return;
        } else if (chunkData.type === 'error') {
          throw new Error(chunkData.error?.message || 'Bedrock streaming error');
        }
      }
    }

    // If we get here without a message_stop, still call onComplete
    await options.onComplete();

  } catch (error) {
    console.error('Bedrock streaming error:', error);
    options.onError(error as Error);
  }
};