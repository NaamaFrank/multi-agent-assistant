import { ConversationsRepo, MessagesRepo } from '../repositories';
import { getConversationsRepo, getMessagesRepo } from '../repositories/factory';
import { Conversation, Message } from '../types';
import { messageService } from './MessageService';

export interface IConversationService {
  createConversation(userId: number, title?: string): Promise<Conversation>;
  getConversations(userId: number): Promise<Conversation[]>;
  getConversationById(conversationId: string, userId: number): Promise<Conversation | null>;
  deleteConversation(conversationId: string, userId: number): Promise<boolean>;
  updateConversation(conversationId: string, userId: number, updates: Partial<Conversation>): Promise<Conversation>;
}

export class ConversationService implements IConversationService {
  constructor(
    private conversationsRepo: ConversationsRepo = getConversationsRepo(),
    private messagesRepo: MessagesRepo = getMessagesRepo()
  ) {}

  async createConversation(userId: number, title?: string): Promise<Conversation> {
    const conversation = await this.conversationsRepo.create(userId, title);
    
    // Return formatted conversation data with proper title handling
    return {
      conversationId: conversation.conversationId,
      userId: conversation.userId,
      title: title || conversation.title,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt
    };
  }

  async getConversations(userId: number): Promise<Conversation[]> {
    return this.conversationsRepo.listByUser(userId);
  }

  async getConversationById(conversationId: string, userId: number): Promise<Conversation | null> {
    const conversation = await this.conversationsRepo.get(conversationId);
    
    // Ensure user owns the conversation
    if (!conversation || conversation.userId !== userId) {
      return null;
    }
    
    return conversation;
  }

  async deleteConversation(conversationId: string, userId: number): Promise<boolean> {
    // First verify user owns the conversation
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      return false;
    }
    
    try {
      // First get all messages for this conversation to delete them
          const messages = await this.messagesRepo.list(conversationId);
      
      // Delete all messages first 
      for (const message of messages) {
        await messageService.deleteMessage(message.messageId);
      }

      // Then delete the conversation itself
      await this.conversationsRepo.delete(conversationId);
      
      return true;
    } catch (error) {
      console.error('Error deleting conversation and messages:', error);
      return false;
    }
  }

  async updateConversation(conversationId: string, userId: number, updates: Partial<Conversation>): Promise<Conversation> {
    // First verify user owns the conversation
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }
    
    // Update the conversation
    await this.conversationsRepo.updateMeta(conversationId, updates);
    
    // Return updated conversation
    return {
      ...conversation,
      ...updates
    };
  }
}

// Export singleton instance
export const conversationService = new ConversationService();