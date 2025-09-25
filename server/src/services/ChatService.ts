import { ConversationsRepo, MessagesRepo, MemoryConversationsRepo, MemoryMessagesRepo } from '../repositories';
import { Conversation, Message } from '../types';

// Default repository instances
const defaultConversationsRepo = new MemoryConversationsRepo();
const defaultMessagesRepo = new MemoryMessagesRepo();

export const ensureConversation = async (
  userId: number, 
  conversationId?: string,
  conversationsRepo: ConversationsRepo = defaultConversationsRepo
): Promise<Conversation> => {
  if (conversationId) {
    const existing = await conversationsRepo.get(conversationId);
    if (existing && existing.userId === userId) {
      return existing;
    }
    throw new Error('Conversation not found or access denied');
  }
  
  return conversationsRepo.create(userId);
};

export const saveUserMessage = async (
  conversationId: string, 
  content: string,
  messagesRepo: MessagesRepo = defaultMessagesRepo,
  conversationsRepo: ConversationsRepo = defaultConversationsRepo
): Promise<Message> => {
  const message = await messagesRepo.append({
    conversationId,
    role: 'user',
    content,
    status: 'complete'
  });

  // Set conversation title from first user message
  await updateConversationTitle(conversationId, content, conversationsRepo);
  
  return message;
};

export const createAssistantMessage = async (
  conversationId: string, 
  agent: string,
  messagesRepo: MessagesRepo = defaultMessagesRepo
): Promise<Message> => {
  return messagesRepo.append({
    conversationId,
    role: 'assistant',
    agent,
    content: '',
    status: 'complete'
  });
};

export const updateAssistantMessage = async (
  messageId: string, 
  content: string, 
  status: Message['status'],
  messagesRepo: MessagesRepo = defaultMessagesRepo
): Promise<void> => {
  await messagesRepo.update(messageId, { content, status });
};

export const updateConversationLastMessageAt = async (
  conversationId: string,
  conversationsRepo: ConversationsRepo = defaultConversationsRepo
): Promise<void> => {
  await conversationsRepo.updateMeta(conversationId, {
    lastMessageAt: new Date()
  });
};

export const getConversationHistory = async (
  conversationId: string, 
  limit = 10,
  messagesRepo: MessagesRepo = defaultMessagesRepo
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> => {
  const messages = await messagesRepo.list(conversationId, { limit });
  
  return messages
    .filter(msg => msg.status === 'complete' && (msg.role === 'user' || msg.role === 'assistant'))
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
};

export const getConversation = async (
  conversationId: string,
  conversationsRepo: ConversationsRepo = defaultConversationsRepo
): Promise<Conversation | null> => {
  return conversationsRepo.get(conversationId);
};

export const getConversationMessages = async (
  conversationId: string, 
  options?: { limit?: number; before?: Date },
  messagesRepo: MessagesRepo = defaultMessagesRepo
): Promise<Message[]> => {
  return messagesRepo.list(conversationId, options);
};

export const getUserConversations = async (
  userId: number,
  conversationsRepo: ConversationsRepo = defaultConversationsRepo
): Promise<Conversation[]> => {
  return conversationsRepo.listByUser(userId);
};

// Helper function
const updateConversationTitle = async (
  conversationId: string, 
  userMessage: string,
  conversationsRepo: ConversationsRepo
): Promise<void> => {
  const conversation = await conversationsRepo.get(conversationId);
  if (conversation && conversation.title === 'New Conversation') {
    // Set title from first user message, truncated to 80 chars
    const title = userMessage.length > 80 
      ? userMessage.substring(0, 77) + '...'
      : userMessage;
    
    await conversationsRepo.updateMeta(conversationId, { title });
  }
};