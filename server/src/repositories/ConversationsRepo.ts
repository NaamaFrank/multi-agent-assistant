import { Conversation } from '../types';

export interface ConversationsRepo {
  create(userId: number, title?: string): Promise<Conversation>;
  get(conversationId: string): Promise<Conversation | null>;
  updateMeta(conversationId: string, updates: Partial<Conversation>): Promise<void>;
  listByUser(userId: number): Promise<Conversation[]>;
}

export class MemoryConversationsRepo implements ConversationsRepo {
  private conversations = new Map<string, Conversation>();
  private nextId = 1;

  async create(userId: number, title?: string): Promise<Conversation> {
    const conversationId = `conv_${this.nextId++}_${Date.now()}`;
    const now = new Date();
    
    const conversation: Conversation = {
      conversationId,
      userId,
      title: title || 'New Conversation',
      createdAt: now,
      lastMessageAt: now
    };
    
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  async get(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async updateMeta(conversationId: string, updates: Partial<Conversation>): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      Object.assign(conversation, updates);
      this.conversations.set(conversationId, conversation);
    }
  }

  async listByUser(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.userId === userId)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  // Helper method for testing
  clear(): void {
    this.conversations.clear();
    this.nextId = 1;
  }
}