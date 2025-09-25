import * as authService from '../src/services/authService';
import { MemoryUserRepo } from '../src/repositories/UserRepo';

describe('AuthService', () => {
  let userRepo: MemoryUserRepo;

  beforeEach(() => {
    // Create a fresh repository for each test
    userRepo = new MemoryUserRepo();
  });

  describe('register', () => {
    const userData = {
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    test('should register a new user successfully', async () => {
      const result = await authService.register(
        userData.email,
        userData.password,
        userData.firstName,
        userData.lastName,
        userRepo
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(userData.email);
      expect(result.user).not.toHaveProperty('password');
      expect(typeof result.token).toBe('string');
    });

    test('should throw error if user already exists', async () => {
      // Register user first
      await authService.register(
        userData.email,
        userData.password,
        userData.firstName,
        userData.lastName,
        userRepo
      );

      // Try to register same user again
      await expect(authService.register(
        userData.email,
        userData.password,
        userData.firstName,
        userData.lastName,
        userRepo
      )).rejects.toThrow('User already exists with this email');
    });
  });

  describe('login', () => {
    const userData = {
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    beforeEach(async () => {
      // Register a user for login tests
      await authService.register(
        userData.email,
        userData.password,
        userData.firstName,
        userData.lastName,
        userRepo
      );
    });

    test('should login successfully with valid credentials', async () => {
      const result = await authService.login(userData.email, userData.password, userRepo);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(userData.email);
      expect(result.user).not.toHaveProperty('password');
      expect(typeof result.token).toBe('string');
    });

    test('should throw error with invalid email', async () => {
      await expect(authService.login('invalid@example.com', userData.password, userRepo))
        .rejects.toThrow('Invalid email or password');
    });

    test('should throw error with invalid password', async () => {
      await expect(authService.login(userData.email, 'wrongpassword', userRepo))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('getUserById', () => {
    test('should return user without password', async () => {
      const registerResult = await authService.register(
        'test@example.com',
        'TestPass123!',
        'John',
        'Doe',
        userRepo
      );

      const user = await authService.getUserById(registerResult.user.id, userRepo);

      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email', 'test@example.com');
      expect(user).not.toHaveProperty('password');
    });

    test('should throw error if user not found', async () => {
      await expect(authService.getUserById(999, userRepo))
        .rejects.toThrow('User not found');
    });
  });

  describe('password hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'TestPass123!';
      const hashedPassword = await authService.hashPassword(password);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(20);
    });

    test('should compare passwords correctly', async () => {
      const password = 'TestPass123!';
      const hashedPassword = await authService.hashPassword(password);

      const isValid = await authService.comparePassword(password, hashedPassword);
      const isInvalid = await authService.comparePassword('wrongpassword', hashedPassword);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });
});