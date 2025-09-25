import request from 'supertest';
import app from '../../src/app';
import authService from '../../src/services/authService';
import UserStorage from '../../src/models/UserStorage';

describe('Agent Streaming Integration Tests', () => {
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    // Create a test user and get auth token
    const authResult = await authService.register(
      'test@example.com',
      'TestPass123!',
      'Test',
      'User'
    );
    authToken = authResult.token;
    userId = authResult.user.id;
  });

  afterAll(async () => {
    // Clean up
    UserStorage.clear();
  });

  describe('GET /api/agent/stream', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/agent/stream?message=hello')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should validate required message parameter', async () => {
      const response = await request(app)
        .get('/api/agent/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate message length', async () => {
      const longMessage = 'x'.repeat(9000); // Exceed MAX_PROMPT_CHARS
      
      const response = await request(app)
        .get(`/api/agent/stream?message=${longMessage}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should stream response with correct headers and events', async () => {
      const response = await request(app)
        .get('/api/agent/stream?message=hello')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', 'text/event-stream')
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive');

      // Basic validation that we got a streaming response
      expect(response.text).toBeDefined();
    });

    it('should handle streaming endpoint', async () => {
      const response = await request(app)
        .get('/api/agent/stream?message=test message')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Basic validation that we got a response
      expect(response.text).toBeDefined();
    });
  });

  describe('POST /api/agent/conversations', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/agent/conversations')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should create new conversation', async () => {
      const response = await request(app)
        .post('/api/agent/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conversationId');
      expect(response.body.data.conversationId).toMatch(/^conv_/);
    });
  });

  describe('GET /api/agent/conversations/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/agent/conversations/test-id')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/agent/conversations/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found');
    });
  });

  describe('GET /api/agent/conversations/:id/messages', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/agent/conversations/test-id/messages')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/agent/conversations/non-existent/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found');
    });
  });

  describe('Rate limiting', () => {
    it('should respond to streaming endpoint', async () => {
      const response = await request(app)
        .get('/api/agent/stream?message=test')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect([200, 429]).toContain(response.status);
    });
  });
});