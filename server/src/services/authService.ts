import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import userStorage from '../models/UserStorage';
import { AuthResult, UserWithoutPassword, JwtPayload } from '../types';

// Ensure environment variables are loaded
dotenv.config();

class AuthService {
  private saltRounds: number;
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

    if (!this.jwtSecret) {
      console.error('JWT_SECRET environment variable is required');
      console.error('Please check your .env file and ensure JWT_SECRET is set');
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateToken(userId: number): string {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as jwt.SignOptions
    );
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.jwtSecret) as JwtPayload;
  }

  async register(
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string
  ): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await userStorage.findByEmail(email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create user
      const userData = {
        email,
        password: hashedPassword,
        firstName,
        lastName
      };

      const user = await userStorage.create(userData);

      // Generate token
      const token = this.generateToken(user.id);

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Find user by email
      const user = await userStorage.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Compare password
      const isPasswordValid = await this.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate token
      const token = this.generateToken(user.id);

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      throw error;
    }
  }

  async getUserById(userId: number): Promise<UserWithoutPassword> {
    try {
      const user = await userStorage.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();