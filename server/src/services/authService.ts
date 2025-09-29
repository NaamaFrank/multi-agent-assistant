import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { UserRepo, MemoryUserRepo } from '../repositories/UserRepo';
import { getUserRepo } from '../repositories/factory';
import { AuthResult, UserWithoutPassword, JwtPayload } from '../types';
import { getConfig } from '../utils/config';

// Ensure environment variables are loaded
dotenv.config();

export interface IAuthService {
  register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  getUserById(userId: number): Promise<UserWithoutPassword>;
  verifyToken(token: string): Promise<JwtPayload>;
  clearUsers(): void; // For testing
}

export class AuthService implements IAuthService {
  constructor(private userRepo: UserRepo = getUserRepo()) {}

  private async hashPassword(password: string): Promise<string> {
    const config = await getConfig();
    return bcrypt.hash(password, config.saltRounds);
  }

  private async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  private async generateToken(userId: number): Promise<string> {
    const config = await getConfig();
    return jwt.sign(
      { userId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    const config = await getConfig();
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  }

  async register(
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string
  ): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepo.findByEmail(email);
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

      const user = await this.userRepo.create(userData);

      // Generate token
      const token = await this.generateToken(user.id);

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
      const user = await this.userRepo.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Compare password
      const isPasswordValid = await this.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate token
      const token = await this.generateToken(user.id);

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
      const user = await this.userRepo.findById(userId);
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

  // Utility function for testing
  clearUsers(): void {
    if (this.userRepo instanceof MemoryUserRepo) {
      (this.userRepo as MemoryUserRepo).clear();
    }
  }
}

// Export singleton instance
export const authService = new AuthService();