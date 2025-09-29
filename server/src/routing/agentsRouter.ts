import { BedrockAdapter } from '../adapters/BedrockAdapter';
import type { AgentKey } from '../utils/prompts';
import {ROUTER_PROMPT} from '../utils/prompts';
import { ClaudeMessage } from '@/types';

const ALLOWED: ReadonlyArray<AgentKey> = ['general', 'coding', 'security', 'travel'];

// Tiny in-context examples to pin behavior (helps determinism on temp>0)
const FEWSHOTS: Array<{ user: string; label: AgentKey }> = [
  { user: 'My lambda hits a timeout; how to fix?', label: 'coding' },
  { user: 'is HSTS enough to stop MITM?', label: 'security' },
  { user: '3 days in Tokyo—what should I see?', label: 'travel' },
  { user: 'what\'s the weather today?', label: 'general' },
];

// Robust JSON extractor: tolerate models that add stray text by slicing first {...} block
function tryParseAgent(jsonish: string): AgentKey {
  const start = jsonish.indexOf('{');
  const end = jsonish.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Router returned non-JSON: ${jsonish.slice(0, 160)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonish.slice(start, end + 1));
  } catch {
    throw new Error(`Router returned invalid JSON: ${jsonish.slice(0, 160)}`);
  }
  const agent = (parsed as any)?.agent;
  if (!ALLOWED.includes(agent)) {
    throw new Error(`Router returned invalid agent: ${String(agent)}`);
  }
  return agent as AgentKey;
}

export class AgentRouter {
  /**
   * Classify a user message into one of the allowed agents using Claude on Bedrock.
   * Throws on invalid model output (so you can decide how to handle upstream).
   */
  static async route(
    input: { message: string },
    abortSignal?: AbortSignal
  ): Promise<AgentKey> {
    const adapter = new BedrockAdapter(
      process.env.MODEL_ID 
    );

    // Build message array with fewshots + the actual message
    const messages: Array<ClaudeMessage> = [];

    for (const ex of FEWSHOTS) {
      messages.push({
        role: 'user',
        content:
          `Classify the message below.\n\n` +
          `Message:\n"""${ex.user}"""\n` +
          `Return only: {"agent":"<label>"}`
      });
      messages.push({ role: 'assistant', content: `{"agent":"${ex.label}"}` });
    }

    messages.push({
      role: 'user',
      content:
        `Classify the message below.\n\n` +
        `Message:\n"""${input.message}"""\n` +
        `Return only: {"agent":"<label>"}`
    });

    // Stream once, concatenate
    let output = '';
    for await (const tok of adapter.generate(messages, abortSignal, ROUTER_PROMPT)) {
      output += tok;
    }

    return tryParseAgent(output);
  }
}
