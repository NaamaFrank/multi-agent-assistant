import { ConversationsRepo, MessagesRepo } from '../repositories';
import { getConversationsRepo, getMessagesRepo } from '../repositories/factory';
import { Conversation, Message } from '../types';

export interface MessageServiceInput {
  conversationId: string;
  userId: number;
  content: string;
  role: 'user' | 'assistant';
  agent?: string;
}

export interface MessageListInput {
  conversationId: string;
  userId: number;
  limit?: number;
  before?: Date;
}

export interface IMessageService {
  addMessage(input: MessageServiceInput): Promise<Message>;
  getMessages(input: MessageListInput): Promise<Message[]>;
  updateMessage(messageId: string, updates: Partial<Message>): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
}

export class MessageService implements IMessageService {
  constructor(
    private messagesRepo: MessagesRepo = getMessagesRepo(),
    private conversationsRepo: ConversationsRepo = getConversationsRepo()
  ) {}

  async addMessage(input: MessageServiceInput): Promise<Message> {
    // Verify user has access to conversation
    const conversation = await this.conversationsRepo.get(input.conversationId);
    if (!conversation || conversation.userId !== input.userId) {
      throw new Error('Conversation not found or access denied');
    }

    // Create the message
    const message = await this.messagesRepo.append({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      status: 'complete',
      ...(input.agent && { agent: input.agent })
    });

    // Update conversation last message timestamp
    await this.conversationsRepo.updateMeta(input.conversationId, {
      lastMessageAt: new Date()
    });

    return message;
  }

  async getMessages(input: MessageListInput): Promise<Message[]> {
    // Verify user has access to conversation
    const conversation = await this.conversationsRepo.get(input.conversationId);
    if (!conversation || conversation.userId !== input.userId) {
      throw new Error('Conversation not found or access denied');
    }

    return this.messagesRepo.list(input.conversationId, {
      limit: input.limit,
      before: input.before
    });
  }

  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
    await this.messagesRepo.update(messageId, updates);
  }

  async deleteMessage(messageId: string): Promise<void>{
    await this.messagesRepo.delete(messageId);
  }

}

// Export singleton instance
export const messageService = new MessageService();