import { ChatService } from '../../src/services/ChatService';
import { MemoryConversationsRepo, MemoryMessagesRepo } from '../../src/repositories';

describe('ChatService', () => {
  let chatService: ChatService;
  let conversationsRepo: MemoryConversationsRepo;
  let messagesRepo: MemoryMessagesRepo;

  beforeEach(() => {
    conversationsRepo = new MemoryConversationsRepo();
    messagesRepo = new MemoryMessagesRepo();
    chatService = new ChatService(conversationsRepo, messagesRepo);
  });

  afterEach(() => {
    conversationsRepo.clear();
    messagesRepo.clear();
  });

  describe('ensureConversation', () => {
    it('should create new conversation when no conversationId provided', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      expect(conversation).toBeDefined();
      expect(conversation.userId).toBe(userId);
      expect(conversation.conversationId).toMatch(/^conv_/);
      expect(conversation.title).toBe('New Conversation');
    });

    it('should return existing conversation when valid conversationId provided', async () => {
      const userId = 1;
      const existing = await chatService.ensureConversation(userId);
      
      const retrieved = await chatService.ensureConversation(userId, existing.conversationId);
      
      expect(retrieved.conversationId).toBe(existing.conversationId);
      expect(retrieved.userId).toBe(userId);
    });

    it('should throw error for invalid conversationId', async () => {
      const userId = 1;
      
      await expect(chatService.ensureConversation(userId, 'invalid-id')).rejects.toThrow('Conversation not found or access denied');
    });

    it('should throw error when accessing another users conversation', async () => {
      const user1 = 1;
      const user2 = 2;
      
      const conversation = await chatService.ensureConversation(user1);
      
      await expect(chatService.ensureConversation(user2, conversation.conversationId)).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('saveUserMessage', () => {
    it('should save user message', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      const message = await chatService.saveUserMessage(conversation.conversationId, 'Hello world');
      
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello world');
      expect(message.status).toBe('complete');
      expect(message.conversationId).toBe(conversation.conversationId);
    });

    it('should set conversation title from first user message', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      await chatService.saveUserMessage(conversation.conversationId, 'What is the weather today?');
      
      const updatedConversation = await chatService.getConversation(conversation.conversationId);
      expect(updatedConversation?.title).toBe('What is the weather today?');
    });

    it('should truncate long titles to 80 characters', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      const longMessage = 'This is a very long message that should be truncated to exactly 80 characters including the ellipsis';
      
      await chatService.saveUserMessage(conversation.conversationId, longMessage);
      
      const updatedConversation = await chatService.getConversation(conversation.conversationId);
      expect(updatedConversation?.title).toHaveLength(80);
      expect(updatedConversation?.title?.endsWith('...')).toBe(true);
    });
  });

  describe('assistant messages', () => {
    it('should create and update assistant message', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      const assistantMessage = await chatService.createAssistantMessage(conversation.conversationId, 'general');
      
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.agent).toBe('general');
      expect(assistantMessage.content).toBe('');
      expect(assistantMessage.status).toBe('complete');
      
      await chatService.updateAssistantMessage(assistantMessage.messageId, 'Hello there!', 'complete');
      
      const messages = await chatService.getConversationMessages(conversation.conversationId);
      const updated = messages.find(m => m.messageId === assistantMessage.messageId);
      
      expect(updated?.content).toBe('Hello there!');
      expect(updated?.status).toBe('complete');
    });
  });

  describe('conversation history', () => {
    it('should return conversation history in correct format', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      // Add some messages
      await chatService.saveUserMessage(conversation.conversationId, 'First message');
      const assistant1 = await chatService.createAssistantMessage(conversation.conversationId, 'general');
      await chatService.updateAssistantMessage(assistant1.messageId, 'First response', 'complete');
      
      await chatService.saveUserMessage(conversation.conversationId, 'Second message');
      const assistant2 = await chatService.createAssistantMessage(conversation.conversationId, 'general');
      await chatService.updateAssistantMessage(assistant2.messageId, 'Second response', 'complete');
      
      const history = await chatService.getConversationHistory(conversation.conversationId);
      
      expect(history).toHaveLength(4);
      expect(history[0]).toEqual({ role: 'user', content: 'First message' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'First response' });
      expect(history[2]).toEqual({ role: 'user', content: 'Second message' });
      expect(history[3]).toEqual({ role: 'assistant', content: 'Second response' });
    });

    it('should limit history to specified number of messages', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      // Add multiple messages
      for (let i = 1; i <= 5; i++) {
        await chatService.saveUserMessage(conversation.conversationId, `Message ${i}`);
        const assistant = await chatService.createAssistantMessage(conversation.conversationId, 'general');
        await chatService.updateAssistantMessage(assistant.messageId, `Response ${i}`, 'complete');
      }
      
      const history = await chatService.getConversationHistory(conversation.conversationId, 4);
      
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe('Message 4');
      expect(history[1].content).toBe('Response 4');
      expect(history[2].content).toBe('Message 5');
      expect(history[3].content).toBe('Response 5');
    });

    it('should exclude incomplete or error messages from history', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      
      await chatService.saveUserMessage(conversation.conversationId, 'User message');
      const assistant1 = await chatService.createAssistantMessage(conversation.conversationId, 'general');
      await chatService.updateAssistantMessage(assistant1.messageId, 'Partial response', 'error');
      
      const assistant2 = await chatService.createAssistantMessage(conversation.conversationId, 'general');
      await chatService.updateAssistantMessage(assistant2.messageId, 'Complete response', 'complete');
      
      const history = await chatService.getConversationHistory(conversation.conversationId);
      
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('User message');
      expect(history[1].content).toBe('Complete response');
    });
  });

  describe('updateConversationLastMessageAt', () => {
    it('should update lastMessageAt timestamp', async () => {
      const userId = 1;
      const conversation = await chatService.ensureConversation(userId);
      const originalTime = conversation.lastMessageAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await chatService.updateConversationLastMessageAt(conversation.conversationId);
      
      const updated = await chatService.getConversation(conversation.conversationId);
      expect(updated?.lastMessageAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });
});