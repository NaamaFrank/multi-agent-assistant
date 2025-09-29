import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { LlmAdapter, LlmUsage, ClaudeMessage } from '../types';



export class BedrockAdapter implements LlmAdapter {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(modelId?: string, region?: string) {
    this.client = new BedrockRuntimeClient({
      region: region || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1'
    });
    this.modelId = modelId || process.env.MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
  }

  async *generate(
    input: string | ClaudeMessage[],
    abortSignal?: AbortSignal,
    prompt?: string
  ): AsyncGenerator<string, LlmUsage> {
    try {
      // Normalize to messages
      const messages: ClaudeMessage[] = Array.isArray(input)
        ? input
        : [{ role: 'user', content: input }];

      const requestBody = this.prepareRequestBody(messages, prompt);

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.modelId,
        body: JSON.stringify(requestBody),
        contentType: 'application/json',
      });

      const response = await this.client.send(command);
      if (!response.body) throw new Error('No response body from Bedrock');

      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for await (const event of response.body) {
        if (abortSignal?.aborted) throw new Error('Request aborted');

        if (event.chunk?.bytes) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            yield chunk.delta.text;
          } else if (chunk.type === 'message_start' && chunk.message?.usage) {
            totalInputTokens = chunk.message.usage.input_tokens || 0;
          } else if (chunk.type === 'message_delta' && chunk.usage) {
            totalOutputTokens = chunk.usage.output_tokens || 0;
          } else if (chunk.type === 'error') {
            throw new Error(`Bedrock streaming error: ${chunk.error?.message || 'Unknown error'}`);
          }
        }
      }

      return { inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
    } catch (error: any) {
      console.error('Bedrock adapter error:', error);
      if (abortSignal?.aborted) throw new Error('Request was aborted');

      if (error.name === 'ValidationException') {
        const region = this.client.config.region || 'us-east-1';
        throw new Error(`Bedrock validation error. Ensure MODEL_ID is an inference profile ID like us.anthropic.claude-3-5-haiku-20241022-v1:0 for region ${region}. Current: ${this.modelId}`);
      }
      if (error.name === 'AccessDeniedException') {
        const region = this.client.config.region || 'us-east-1';
        throw new Error(`Bedrock denied access. Ensure model access is granted in Bedrock (${region}) and MODEL_ID is an inference profile ID like us.anthropic.claude-3-5-haiku-20241022-v1:0.`);
      }
      if (error.name === 'ThrottlingException') {
        throw new Error('Bedrock request was throttled. Please try again later.');
      }
      throw new Error(`Bedrock generation failed: ${error.message}`);
    }
  }

  private prepareRequestBody(messages: ClaudeMessage[], system?: string): any {
    if (this.modelId.includes('claude')) {
      // Convert to Anthropic Bedrock schema
      const anthropicMessages = messages.map(m => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }]
      }));

      const body: any = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '1000'),
        temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
        messages: anthropicMessages,
      };

      if (system && system.trim()) {
        body.system = system;
      }

      return body;
    }

    throw new Error(`Unsupported model: ${this.modelId}`);
  }
}
