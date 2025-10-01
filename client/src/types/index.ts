export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
  message?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Chat types
export interface Message {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
  timestamp: string;
  status: 'complete' | 'interrupted' | 'error';
}

export interface Conversation {
  conversationId: string;
  userId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messages?: Message[];
}

export interface CreateMessageRequest {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
}

export type AgentType = 'general' | 'coding' | 'security' | 'travel';
export type MessageStatus = 'complete' | 'interrupted' | 'error';

export const agentColors: Record<AgentType, string> = {
  general: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  coding: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  security: 'bg-red-500/20 text-red-400 border border-red-500/30',
  travel: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
};

export const agentNames: Record<AgentType, string> = {
  general: 'General Assistant',
  coding: 'Coding Expert',
  security: 'Security Advisor',
  travel: 'Travel Guide',
};

// Streaming types
export interface StreamEvent {
  meta?: {
    conversationId: string;
    agent: AgentType;
    model?: string;
    userMessageId: string;
    assistantMessageId: string;
  };
  chunk?: {
    delta: string;
  };
  title?: {
    title: string;
  };
  tool_use?: {
    tool: string;
    parameters: any;
    status?: 'executing';
  };
  done?: {
    usage: {
      inputTokens: number | null;
      outputTokens: number | null;
    };
  };
  error?: {
    error?: string;
    message?: string;
    code?: string;
  };
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// UI State types
export interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingConversation: boolean; // For conversation switching
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  // Cache for messages by conversation ID
  messageCache: Record<string, Message[]>;
  // Tool use indicator
  toolInUse?: { tool: string; parameters: any } | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Form types
export interface MessageFormData {
  message: string;
}

// Configuration
export interface ApiConfig {
  baseUrl: string;
  streamingUrl: string;
  timeout: number;
}