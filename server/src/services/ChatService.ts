import { ConversationsRepo, MessagesRepo } from '../repositories';
import { getConversationsRepo, getMessagesRepo } from '../repositories/factory';
import { Conversation, Message } from '../types';
import { BedrockAdapter } from '@/adapters/BedrockAdapter';
import { TITLE_PROMPT } from '@/utils/prompts';

export const ensureConversation = async (
  userId: number, 
  conversationId?: string,
  conversationsRepo: ConversationsRepo = getConversationsRepo()
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
  messagesRepo: MessagesRepo = getMessagesRepo(),
  conversationsRepo: ConversationsRepo = getConversationsRepo()
): Promise<Message> => {
  const message = await messagesRepo.append({
    conversationId,
    role: 'user',
    content,
    status: 'complete'
  });
  
  return message;
};

export const createAssistantMessageWithContent = async (
  conversationId: string, 
  agent: string,
  content: string,
  messagesRepo: MessagesRepo = getMessagesRepo()
): Promise<Message> => {
  return messagesRepo.append({
    conversationId,
    role: 'assistant',
    agent,
    content,
    status: 'complete'
  });
};

export const updateAssistantMessage = async (
  messageId: string, 
  content: string, 
  status: Message['status'],
  messagesRepo: MessagesRepo = getMessagesRepo()
): Promise<void> => {
  await messagesRepo.update(messageId, { content, status });
};

export const updateConversationLastMessageAt = async (
  conversationId: string,
  conversationsRepo: ConversationsRepo = getConversationsRepo()
): Promise<void> => {
  await conversationsRepo.updateMeta(conversationId, {
    lastMessageAt: new Date()
  });
};

export const getConversationHistory = async (
  conversationId: string, 
  limit = 10,
  messagesRepo: MessagesRepo = getMessagesRepo()
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
  conversationsRepo: ConversationsRepo = getConversationsRepo()
): Promise<Conversation | null> => {
  return conversationsRepo.get(conversationId);
};

export const getConversationMessages = async (
  conversationId: string, 
  options?: { limit?: number; before?: Date },
  messagesRepo: MessagesRepo = getMessagesRepo()
): Promise<Message[]> => {
  return messagesRepo.list(conversationId, options);
};

export const getUserConversations = async (
  userId: number,
  conversationsRepo: ConversationsRepo = getConversationsRepo()
): Promise<Conversation[]> => {
  return conversationsRepo.listByUser(userId);
};
