import * as chatService from '../../src/services/ChatService';
import { MemoryConversationsRepo, MemoryMessagesRepo } from '../../src/repositories';

describe('ChatService', () => {
  let conversationsRepo: MemoryConversationsRepo;
  let messagesRepo: MemoryMessagesRepo;

  beforeEach(() => {
    conversationsRepo = new MemoryConversationsRepo();
    messagesRepo = new MemoryMessagesRepo();
  });

  afterEach(() => {
    conversationsRepo.clear();
    messagesRepo.clear();
  });

  describe('ensureConversation', () => {
    it('should create new conversation when no conversationId provided', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);
      
      expect(conversation).toBeDefined();
      expect(conversation.userId).toBe(userId);
      expect(conversation.conversationId).toMatch(/^conv_/);
      expect(conversation.title).toBe('New Conversation');
    });

    it('should return existing conversation when valid conversationId provided', async () => {
      const userId = 1;
      const existing = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      const retrieved = await chatService.ensureConversation(userId, existing.conversationId, conversationsRepo);

      expect(retrieved.conversationId).toBe(existing.conversationId);
      expect(retrieved.userId).toBe(userId);
    });

    it('should throw error for invalid conversationId', async () => {
      const userId = 1;
      
      await expect(chatService.ensureConversation(userId, 'invalid-id', conversationsRepo)).rejects.toThrow('Conversation not found or access denied');
    });

    it('should throw error when user tries to access another user\'s conversation', async () => {
      const user1 = 1;
      const user2 = 2;
      const conversation = await chatService.ensureConversation(user1, undefined, conversationsRepo);

      await expect(chatService.ensureConversation(user2, conversation.conversationId, conversationsRepo)).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('saveUserMessage', () => {
    it('should save user message and return message object', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      const message = await chatService.saveUserMessage(conversation.conversationId, 'Hello world', messagesRepo, conversationsRepo);

      expect(message.conversationId).toBe(conversation.conversationId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello world');
      expect(message.status).toBe('complete');
      expect(message.messageId).toMatch(/^msg_/);
    });

    it('should update conversation title from first user message', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      await chatService.saveUserMessage(conversation.conversationId, 'What is the weather today?', messagesRepo, conversationsRepo);

      const updatedConversation = await chatService.getConversation(conversation.conversationId, conversationsRepo);
      expect(updatedConversation?.title).toBe('What is the weather today?');
    });

    it('should truncate long message for conversation title', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      const longMessage = 'This is a very long message that should be truncated when used as a conversation title because it exceeds the maximum length';
      await chatService.saveUserMessage(conversation.conversationId, longMessage, messagesRepo, conversationsRepo);

      const updatedConversation = await chatService.getConversation(conversation.conversationId, conversationsRepo);
      expect(updatedConversation?.title).toBe('This is a very long message that should be truncated when used as a conversat...');
    });
  });

  describe('createAssistantMessage', () => {
    it('should create assistant message with empty content', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      const assistantMessage = await chatService.createAssistantMessage(conversation.conversationId, 'general', messagesRepo);

      expect(assistantMessage.conversationId).toBe(conversation.conversationId);
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.agent).toBe('general');
      expect(assistantMessage.content).toBe('');
      expect(assistantMessage.status).toBe('complete');
    });
  });

  describe('updateAssistantMessage', () => {
    it('should update assistant message content and status', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);
      const assistantMessage = await chatService.createAssistantMessage(conversation.conversationId, 'general', messagesRepo);

      await chatService.updateAssistantMessage(assistantMessage.messageId, 'Hello there!', 'complete', messagesRepo);

      const messages = await chatService.getConversationMessages(conversation.conversationId, undefined, messagesRepo);
      const updatedMessage = messages.find(m => m.messageId === assistantMessage.messageId);
      
      expect(updatedMessage?.content).toBe('Hello there!');
      expect(updatedMessage?.status).toBe('complete');
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history with user and assistant messages', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      // Add messages
      await chatService.saveUserMessage(conversation.conversationId, 'First message', messagesRepo, conversationsRepo);
      const assistant1 = await chatService.createAssistantMessage(conversation.conversationId, 'general', messagesRepo);
      await chatService.updateAssistantMessage(assistant1.messageId, 'First response', 'complete', messagesRepo);
      
      await chatService.saveUserMessage(conversation.conversationId, 'Second message', messagesRepo, conversationsRepo);
      const assistant2 = await chatService.createAssistantMessage(conversation.conversationId, 'general', messagesRepo);
      await chatService.updateAssistantMessage(assistant2.messageId, 'Second response', 'complete', messagesRepo);

      const history = await chatService.getConversationHistory(conversation.conversationId, 10, messagesRepo);

      expect(history).toHaveLength(4);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('First message');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('First response');
    });

    it('should limit history to specified count', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      // Add multiple messages
      for (let i = 1; i <= 5; i++) {
        await chatService.saveUserMessage(conversation.conversationId, `Message ${i}`, messagesRepo, conversationsRepo);
      }

      const history = await chatService.getConversationHistory(conversation.conversationId, 3, messagesRepo);

      expect(history).toHaveLength(3);
    });

    it('should only include complete messages', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      await chatService.saveUserMessage(conversation.conversationId, 'User message', messagesRepo, conversationsRepo);
      
      // Create incomplete assistant message
      const incompleteMessage = await chatService.createAssistantMessage(conversation.conversationId, 'general', messagesRepo);
      await chatService.updateAssistantMessage(incompleteMessage.messageId, 'Partial response', 'interrupted', messagesRepo);
      
      // Create complete assistant message
      const completeMessage = await chatService.createAssistantMessage(conversation.conversationId, 'general', messagesRepo);
      await chatService.updateAssistantMessage(completeMessage.messageId, 'Complete response', 'complete', messagesRepo);

      const history = await chatService.getConversationHistory(conversation.conversationId, 10, messagesRepo);

      expect(history).toHaveLength(2); // Only user message and complete assistant message
      expect(history[1].content).toBe('Complete response');
    });
  });

  describe('getUserConversations', () => {
    it('should return all conversations for a user', async () => {
      const userId = 1;
      
      const conv1 = await chatService.ensureConversation(userId, undefined, conversationsRepo);
      const conv2 = await chatService.ensureConversation(userId, undefined, conversationsRepo);

      const conversations = await chatService.getUserConversations(userId, conversationsRepo);

      expect(conversations).toHaveLength(2);
      expect(conversations.map(c => c.conversationId)).toContain(conv1.conversationId);
      expect(conversations.map(c => c.conversationId)).toContain(conv2.conversationId);
    });

    it('should not return conversations from other users', async () => {
      const user1 = 1;
      const user2 = 2;
      
      await chatService.ensureConversation(user1, undefined, conversationsRepo);
      await chatService.ensureConversation(user2, undefined, conversationsRepo);

      const user1Conversations = await chatService.getUserConversations(user1, conversationsRepo);
      const user2Conversations = await chatService.getUserConversations(user2, conversationsRepo);

      expect(user1Conversations).toHaveLength(1);
      expect(user2Conversations).toHaveLength(1);
      expect(user1Conversations[0].userId).toBe(user1);
      expect(user2Conversations[0].userId).toBe(user2);
    });
  });
});