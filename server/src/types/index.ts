export interface User {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithoutPassword {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: UserWithoutPassword;
  token: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// Chat and Agent Types
export interface Conversation {
  conversationId: string;
  userId: number;
  title: string;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface Message {
  messageId: string;
  conversationId: string;
  ts: Date;
  role: 'user' | 'assistant' | 'tool';
  agent?: string;
  content: string;
  status: 'complete' | 'interrupted' | 'error';
}

export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface StreamEvents {
  meta: {
    conversationId: string;
    agent: string;
    userMessageId: string;
    assistantMessageId: string;
  };
  chunk: {
    delta: string;
  };
  done: {
    usage: LlmUsage;
    durationMs: number;
  };
  error: {
    message: string;
  };
}

// LLM Adapter Types
export interface LlmAdapter {
  generate(
    prompt: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<string, LlmUsage>;
}

export interface GenerateOptions {
  user: { userId: number };
  conversationId: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  abortSignal?: AbortSignal;
}

export type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; is_error?: boolean; content?: string };

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  // can be plain string or an array of Anthropic content blocks
  content: string | AnthropicBlock[];
}

//Tools types
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Json;
}

export interface ToolResult {
  tool_use_id: string;
  content: Json;         // JSON-serializable result
  isError?: boolean;   
}

export interface Tool {
  name: string;
  schema(): ToolSchema;
  execute(input: Json): Promise<ToolResult>;
}
