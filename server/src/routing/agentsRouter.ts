import { BedrockAdapter } from '../adapters/BedrockAdapter';
import type { AgentKey } from '../utils/prompts';
import {ROUTER_PROMPT} from '../utils/prompts';
import { ClaudeMessage } from '@/types';

const ALLOWED: ReadonlyArray<AgentKey> = ['general', 'coding', 'security', 'travel'];

// Robust JSON extractor: tolerate models that add stray text by slicing first {...} block
function tryParseAgent(jsonish: string): AgentKey {
  console.log(`[DEBUG] Raw router response: "${jsonish.trim()}"`);
  
  // Try to extract JSON object using regex for more robustness
  const jsonRegex = /{[\s\S]*?}/;
  const match = jsonish.match(jsonRegex);
  
  if (!match) {
    // Default fallback if no JSON-like structure is found
    console.error(`Router returned non-JSON: "${jsonish.slice(0, 160)}"`);
    return 'general';
  }
  
  let parsed: unknown;
  try {
    // Attempt to parse the extracted JSON
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.error(`Router returned invalid JSON: "${match[0]}"`, e);
    return 'general';
  }
  
  const agent = (parsed as any)?.agent;
  if (!ALLOWED.includes(agent)) {
    console.error(`Router returned invalid agent: "${String(agent)}", defaulting to general`);
    return 'general';
  }
  
  return agent as AgentKey;
}

export class AgentRouter {
  /**
   * Classify a user message into one of the allowed agents using Claude on Bedrock.
   * Uses a simplified approach that just takes the last few messages.
   */
  static async route(
    input: { history: Array<ClaudeMessage> },
    abortSignal?: AbortSignal
  ): Promise<AgentKey> {
    console.log("[Router] Starting agent routing");
    const adapter = new BedrockAdapter(
      process.env.MODEL_ID 
    );

    // Check if we have any history
    if (!input.history || input.history.length === 0) {
      console.log("[Router] No messages to route, defaulting to general agent");
      return 'general';
    }

    try {
      // Just use the most recent messages (up to 4) to avoid token limits
      const recentHistory = input.history.slice(-4);
      console.log(`[Router] Using ${recentHistory.length} recent messages for routing`);
      
      // Stream once, concatenate with timeout protection
      let output = '';
      for await (const tok of adapter.generate(recentHistory, abortSignal, ROUTER_PROMPT)) {
        output += tok;
      }

      // Check for empty output
      if (!output || output.trim() === '') {
        console.log("[Router] Empty response from adapter, defaulting to general agent");
        return 'general';
      }

      return tryParseAgent(output);
    } catch (error) {
      console.error("[Router] Error during routing:", error);
      return 'general'; // Default to general agent on any error
    }
  }
}
