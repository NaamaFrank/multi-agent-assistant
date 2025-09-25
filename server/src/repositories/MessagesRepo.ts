import { Message } from '../types';

export interface MessagesRepo {
  append(message: Omit<Message, 'messageId' | 'ts'>): Promise<Message>;
  list(conversationId: string, options?: { limit?: number; before?: Date }): Promise<Message[]>;
  update(messageId: string, updates: Partial<Message>): Promise<void>;
  get(messageId: string): Promise<Message | null>;
}

export class MemoryMessagesRepo implements MessagesRepo {
  private messages = new Map<string, Message>();
  private messagesByConversation = new Map<string, string[]>();
  private nextId = 1;

  async append(message: Omit<Message, 'messageId' | 'ts'>): Promise<Message> {
    const messageId = `msg_${this.nextId++}_${Date.now()}`;
    const fullMessage: Message = {
      ...message,
      messageId,
      ts: new Date()
    };
    
    this.messages.set(messageId, fullMessage);
    
    // Index by conversation
    const conversationMessages = this.messagesByConversation.get(message.conversationId) || [];
    conversationMessages.push(messageId);
    this.messagesByConversation.set(message.conversationId, conversationMessages);
    
    return fullMessage;
  }

  async list(conversationId: string, options?: { limit?: number; before?: Date }): Promise<Message[]> {
    const messageIds = this.messagesByConversation.get(conversationId) || [];
    let messages = messageIds
      .map(id => this.messages.get(id)!)
      .filter(msg => msg !== undefined)
      .sort((a, b) => a.ts.getTime() - b.ts.getTime()); // Chronological order
    
    if (options?.before) {
      messages = messages.filter(msg => msg.ts < options.before!);
    }
    
    if (options?.limit) {
      messages = messages.slice(-options.limit); // Get last N messages
    }
    
    return messages;
  }

  async update(messageId: string, updates: Partial<Message>): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      Object.assign(message, updates);
      this.messages.set(messageId, message);
    }
  }

  async get(messageId: string): Promise<Message | null> {
    return this.messages.get(messageId) || null;
  }

  // Helper method for testing
  clear(): void {
    this.messages.clear();
    this.messagesByConversation.clear();
    this.nextId = 1;
  }
}