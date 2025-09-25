import { ConversationsRepo, MessagesRepo } from '../repositories';
import { Conversation, Message } from '../types';

export class ChatService {
  constructor(
    private conversationsRepo: ConversationsRepo,
    private messagesRepo: MessagesRepo
  ) {}

  async ensureConversation(userId: number, conversationId?: string): Promise<Conversation> {
    if (conversationId) {
      const existing = await this.conversationsRepo.get(conversationId);
      if (existing && existing.userId === userId) {
        return existing;
      }
      throw new Error('Conversation not found or access denied');
    }
    
    return this.conversationsRepo.create(userId);
  }

  async saveUserMessage(conversationId: string, content: string): Promise<Message> {
    const message = await this.messagesRepo.append({
      conversationId,
      role: 'user',
      content,
      status: 'complete'
    });

    // Set conversation title from first user message
    await this.updateConversationTitle(conversationId, content);
    
    return message;
  }

  async createAssistantMessage(conversationId: string, agent: string): Promise<Message> {
    return this.messagesRepo.append({
      conversationId,
      role: 'assistant',
      agent,
      content: '',
      status: 'complete'
    });
  }

  async updateAssistantMessage(messageId: string, content: string, status: Message['status']): Promise<void> {
    await this.messagesRepo.update(messageId, { content, status });
  }

  async updateConversationLastMessageAt(conversationId: string): Promise<void> {
    await this.conversationsRepo.updateMeta(conversationId, {
      lastMessageAt: new Date()
    });
  }

  async getConversationHistory(conversationId: string, limit = 10): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.messagesRepo.list(conversationId, { limit });
    
    return messages
      .filter(msg => msg.status === 'complete' && (msg.role === 'user' || msg.role === 'assistant'))
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversationsRepo.get(conversationId);
  }

  async getConversationMessages(conversationId: string, options?: { limit?: number; before?: Date }): Promise<Message[]> {
    return this.messagesRepo.list(conversationId, options);
  }

  async getUserConversations(userId: number): Promise<Conversation[]> {
    return this.conversationsRepo.listByUser(userId);
  }

  private async updateConversationTitle(conversationId: string, userMessage: string): Promise<void> {
    const conversation = await this.conversationsRepo.get(conversationId);
    if (conversation && conversation.title === 'New Conversation') {
      // Set title from first user message, truncated to 80 chars
      const title = userMessage.length > 80 
        ? userMessage.substring(0, 77) + '...'
        : userMessage;
      
      await this.conversationsRepo.updateMeta(conversationId, { title });
    }
  }
}