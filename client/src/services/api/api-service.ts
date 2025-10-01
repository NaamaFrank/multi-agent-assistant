import type { 
  Message, 
  Conversation, 
  CreateMessageRequest, 
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  ApiResponse
} from '@/types';
import { apiClient } from '@/lib/api';
import { authTokenService } from '@/lib/auth-token';

interface TokenRefreshRequest {
  token: string;
}

interface TokenRefreshResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
}

class ApiService {
  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Auth endpoints might return AuthResponse directly instead of wrapped in ApiResponse
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data || response as any;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', credentials);
    return response.data || response as any;
  }

  async refreshToken(request: TokenRefreshRequest): Promise<ApiResponse<TokenRefreshResponse>> {
    try {
      // Use direct token refresh endpoint
      const response = await apiClient.post<TokenRefreshResponse>('/auth/refresh', request);
      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return {
        success: false,
        message: 'Token refresh failed',
        errors: [{ field: 'token', message: 'Unable to refresh token' }]
      };
    }
  }
  
  /**
   * Check if token is valid before making the request
   * This can be used as a wrapper for important API calls
   * to ensure token validity before proceeding
   */
  async withValidToken<T>(apiCall: () => Promise<T>): Promise<T> {
    // Dispatch event to check and refresh token if needed
    if (!authTokenService.isTokenValid()) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      // Give it a moment to refresh if possible
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Proceed with the API call
    return apiCall();
  }

  // Conversation endpoints
  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<Conversation[]>('/agent/conversations');
    return response.data || [];
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await apiClient.get<Conversation>(`/agent/conversations/${conversationId}`);
    if (!response.data) {
      throw new Error('Conversation not found');
    }
    return response.data;
  }

  async createConversation(title?: string): Promise<Conversation> {
    const response = await apiClient.post<Conversation>('/agent/conversations', {
      title: title || 'New Conversation',
    });
    if (!response.data) {
      throw new Error('Failed to create conversation');
    }
    return response.data;
  }

  async updateConversation(conversationId: string, updates: Partial<Pick<Conversation, 'title'>>): Promise<Conversation> {
    const response = await apiClient.put<Conversation>(`/agent/conversations/${conversationId}`, updates);
    if (!response.data) {
      throw new Error('Failed to update conversation');
    }
    return response.data;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/agent/conversations/${conversationId}`);
  }

  // Message endpoints
  async getMessages(conversationId: string): Promise<Message[]> {
    return this.withValidToken(async () => {
      const response = await apiClient.get<Message[]>(`/agent/conversations/${conversationId}/messages`);
      return response.data || [];
    });
  }

  async createMessage(request: CreateMessageRequest): Promise<Message> {
    return this.withValidToken(async () => {
      const response = await apiClient.post<Message>(`/agent/conversations/${request.conversationId}/messages`, request);
      if (!response.data) {
        throw new Error('Failed to create message');
      }
      return response.data;
    });
  }

  async getMessage(messageId: string): Promise<Message> {
    const response = await apiClient.get<Message>(`/agent/messages/${messageId}`);
    if (!response.data) {
      throw new Error('Message not found');
    }
    return response.data;
  }

  async updateMessage(messageId: string, updates: Partial<Pick<Message, 'content' | 'agent'>>): Promise<Message> {
    const response = await apiClient.put<Message>(`/agent/messages/${messageId}`, updates);
    if (!response.data) {
      throw new Error('Failed to update message');
    }
    return response.data;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await apiClient.delete(`/agent/messages/${messageId}`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await apiClient.get<{ status: string; timestamp: string }>('/health');
    if (!response.data) {
      throw new Error('Health check failed');
    }
    return response.data;
  }
}

export const apiService = new ApiService();