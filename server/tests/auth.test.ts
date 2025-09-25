import request from 'supertest';
import app from '../src/app';
import * as authService from '../src/services/authService';

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

describe('Auth Endpoints', () => {
  const testUser: TestUser = {
    email: 'test@example.com',
    password: 'TestPass123!',
    firstName: 'John',
    lastName: 'Doe'
  };

  let authToken: string;

  beforeEach(() => {
    // Clear users before each test
    authService.clearUsers();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data.user.email).toBe(testUser.email);

      authToken = response.body.data.token;
    });

    test('should not register user with existing email', async () => {
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Try to register same user again
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists with this email');
    });

    test('should validate required fields', async () => {
      const invalidUser = {
        email: 'invalid-email',
        password: '123', // too short
        firstName: 'A', // too short
        lastName: '' // empty
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);
      authToken = response.body.data.token;
    });

    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    test('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    beforeEach(async () => {
      // Register a user and get token
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);
      authToken = response.body.data.token;
    });

    test('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('should not access protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. No valid token provided.');
    });

    test('should not access protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token.');
    });
  });

  describe('POST /api/auth/verify-token', () => {
    beforeEach(async () => {
      // Register a user and get token
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);
      authToken = response.body.data.token;
    });

    test('should verify valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token is valid');
      expect(response.body.data).toHaveProperty('userId');
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      // Register a user and get token
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);
      authToken = response.body.data.token;
    });

    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful. Please remove the token from client-side storage.');
    });
  });
});