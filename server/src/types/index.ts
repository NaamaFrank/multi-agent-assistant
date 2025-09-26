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