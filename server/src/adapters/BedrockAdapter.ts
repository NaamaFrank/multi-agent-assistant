import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { LlmAdapter, LlmUsage, ClaudeMessage, ToolSchema } from '../types';

type ToolRoundResult = {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: any }>;
  assistantBlocks: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: any }
  >;
  usage: { inputTokens: number; outputTokens: number };
};

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
        const region = this.client.config.region;
        throw new Error(`Bedrock validation error. Ensure MODEL_ID is an inference profile ID like us.anthropic.claude-3-5-haiku-20241022-v1:0 for region ${region}. Current: ${this.modelId}`);
      }
      if (error.name === 'AccessDeniedException') {
        const region = this.client.config.region;
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
      const anthropicMessages = messages.map(m => {
        let content: any;
        if (Array.isArray(m.content)) {
          content = m.content; // already text/tool_use/tool_result blocks
        } else if (typeof m.content === 'string') {
          content = [{ type: 'text', text: m.content }];
        } else {
          content = [{ type: 'text', text: JSON.stringify(m.content) }];
        }
        return { role: m.role, content };
      });

      const body: any = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '1000'),
        temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
        messages: anthropicMessages,
      };

      if (system && system.trim()) body.system = system;

      console.log('[DEBUG] BedrockAdapter request body:');
      console.log(`[DEBUG] Message count: ${messages.length}`);
      console.log(`[DEBUG] Message preview:`);
      anthropicMessages.forEach((msg, i) => {
        const raw = JSON.stringify(msg.content);
        const contentPreview = raw.substring(0, 100) + (raw.length > 100 ? '...' : '');
        console.log(`[DEBUG] [${i}] ${msg.role}: ${contentPreview}`);
      });

      return body;
    }

    throw new Error(`Unsupported model: ${this.modelId}`);
  }

  /**
   * Tool round with robust parsing of streamed tool_use input.
   * Index-based buffering & finalization to avoid empty tool inputs.
   */
  async toolRound(
    input: string | ClaudeMessage[],
    opts?: { system?: string; tools?: ToolSchema[]; abortSignal?: AbortSignal }
  ): Promise<ToolRoundResult> {
    const messages: ClaudeMessage[] = Array.isArray(input) ? input : [{ role: "user", content: input }];

    const body = this.prepareRequestBody(messages, opts?.system);
    if (opts?.tools && opts.tools.length > 0) {
      (body as any).tools = opts.tools;              // Anthropic tool spec
      (body as any).tool_choice = { type: "auto" };  // let model decide
    }

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
      contentType: "application/json",
    });

    const response = await this.client.send(command);
    if (!response.body) throw new Error("No response body from Bedrock");

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Use content block index for tool_use buffering
    const toolUseBuffers = new Map<number, string>(); // index -> JSON fragments
    const toolUseByIndex = new Map<number, { id: string; name: string }>();

    let accText = "";
    const toolCalls: Array<{ id: string; name: string; input: any }> = [];
    const toolUseBlocks: Array<{ type: 'tool_use'; id: string; name: string; input: any }> = [];

    // Helper to extract index consistently from different event shapes
    const getIdx = (chunk: any): number | undefined =>
      typeof chunk.index === 'number'
        ? chunk.index
        : typeof chunk.content_block_index === 'number'
          ? chunk.content_block_index
          : typeof chunk.content_block?.index === 'number'
            ? chunk.content_block.index
            : undefined;

    for await (const event of response.body) {
      if (opts?.abortSignal?.aborted) throw new Error("Request aborted");
      if (!event.chunk?.bytes) continue;

      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

      switch (chunk.type) {
        case "message_start":
          totalInputTokens = chunk.message?.usage?.input_tokens || 0;
          break;

        case "content_block_start": {
          const cb = chunk.content_block;
          const idx = getIdx(chunk);
          if (cb?.type === "tool_use") {
            const id: string = cb.id;
            const name: string = cb.name;

            // seed entries (input will be filled on stop)
            toolCalls.push({ id, name, input: {} });
            toolUseBlocks.push({ type: "tool_use", id, name, input: {} });

            if (typeof idx === "number") {
              toolUseByIndex.set(idx, { id, name });
              toolUseBuffers.set(idx, "");
            }
          }
          break;
        }

        case "content_block_delta": {
          const delta = chunk.delta;
          const idx = getIdx(chunk);

          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            accText += delta.text;
          }

          if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
            if (typeof idx === "number" && toolUseBuffers.has(idx)) {
              toolUseBuffers.set(idx, (toolUseBuffers.get(idx) ?? "") + delta.partial_json);
            }
          }
          break;
        }

        case "content_block_stop": {
          // finalize if this index belongs to a tool_use block
          const idx = getIdx(chunk);
          if (typeof idx === "number" && toolUseByIndex.has(idx)) {
            const buf = toolUseBuffers.get(idx) ?? "";
            const { id } = toolUseByIndex.get(idx)!;

            if (buf) {
              try {
                const parsed = JSON.parse(buf);
                const call = toolCalls.find(c => c.id === id);
                if (call) call.input = parsed;

                const block = toolUseBlocks.find(b => b.id === id);
                if (block) block.input = parsed;
              } catch (e) {
                // leave {} if parsing fails; optional: log
                console.warn("[BedrockAdapter] Failed to parse tool_use input JSON:", e);
              }
            }

            toolUseBuffers.delete(idx);
            toolUseByIndex.delete(idx);
          }
          break;
        }

        case "message_delta":
          totalOutputTokens = chunk.usage?.output_tokens || totalOutputTokens;
          break;

        case "error":
          throw new Error(`Bedrock streaming error: ${chunk.error?.message || "Unknown error"}`);
      }
    }

    // Build assistantBlocks AFTER we finalized inputs
    const assistantBlocks: Array<
      { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: any }
    > = [];
    if (accText) assistantBlocks.push({ type: 'text', text: accText });
    assistantBlocks.push(...toolUseBlocks);

    console.log("[DEBUG] Tool calls:", toolCalls.map(c => ({ id: c.id, name: c.name, input: c.input })));

    return {
      text: accText,
      toolCalls,
      assistantBlocks,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
    };
  }
}
