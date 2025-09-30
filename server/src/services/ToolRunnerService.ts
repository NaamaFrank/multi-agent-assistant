// src/services/ToolRunner.ts
import { BedrockAdapter } from "@/adapters/BedrockAdapter";
import { ToolRegistry } from "@/tools/ToolRegistry";
import { ToolSchema, ToolResult } from "@/types";
import { ClaudeMessage } from "@/types";

export interface ToolRunnerOptions {
  system?: string;
  onStreamToken?: (s: string) => void;  // optional: stream text tokens to SSE as they arrive in each *final* round
  onToolUse?: (tool: { name: string, input: any }) => void; // optional: notify when a tool is being used
  abortSignal?: AbortSignal;
}

/**
 * Run a conversation turn with tools until the model no longer asks for tools.
 * Returns final assistant text and usage (best-effort aggregate).
 */
export class ToolRunner {
  constructor(private adapter: BedrockAdapter, private registry: ToolRegistry) {}

  get toolSchemas(): ToolSchema[] {
    return this.registry.getSchemas();
  }

  async runWithTools(
    history: ClaudeMessage[], // includes prior turns + the *new user message* at the end
    opts?: ToolRunnerOptions
  ): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
    let workingHistory = [...history];
    let totalIn = 0, totalOut = 0;

    while (true) {
      const round = await this.adapter.toolRound(workingHistory, {
        system: opts?.system,
        tools: this.toolSchemas,
        abortSignal: opts?.abortSignal
      });

      totalIn += round.usage.inputTokens;
      totalOut += round.usage.outputTokens;

      // Always persist the assistant's output (text + any tool_use) to history
      if (round.assistantBlocks && round.assistantBlocks.length > 0) {
        workingHistory = [
          ...workingHistory,
          { role: "assistant", content: round.assistantBlocks }
        ];
      }

      // If no tool calls, we’re done
      if (round.toolCalls.length === 0) {
        if (opts?.onStreamToken && round.text) opts.onStreamToken(round.text);
        return { text: round.text, usage: { inputTokens: totalIn, outputTokens: totalOut } };
      }

      // Execute tools
      const toolResults = [];
      for (const call of round.toolCalls) {
        // Notify about tool usage if callback is provided
        if (opts?.onToolUse) {
          opts.onToolUse({
            name: call.name,
            input: call.input
          });
        }
        
        const res = await this.registry.execute(call);
        toolResults.push({
          tool_use_id: call.id,              
          isError: !!res.isError,
          content: typeof res.content === "string" ? res.content : JSON.stringify(res.content)
        });
      }

      // Reply with user message containing tool_result blocks
      workingHistory = [
        ...workingHistory,
        {
          role: "user",
          content: toolResults.map(r => ({
            type: "tool_result",
            tool_use_id: r.tool_use_id,
            is_error: r.isError,
            content: r.content
          }))
        }
      ];

      // loop continues; model will read tool_result and produce the final answer or ask for more tools
    }
  }
}
