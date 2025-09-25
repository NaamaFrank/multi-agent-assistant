import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { MemoryUserRepo, UserRepo } from '../repositories/UserRepo';
import { AuthResult, UserWithoutPassword, JwtPayload } from '../types';

// Ensure environment variables are loaded
dotenv.config();

// Configuration constants
const config = {
  saltRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
};

// Validate JWT secret on module load
if (!config.jwtSecret) {
  console.error('JWT_SECRET environment variable is required');
  console.error('Please check your .env file and ensure JWT_SECRET is set');
  throw new Error('JWT_SECRET environment variable is required');
}

// Default repository instance
const defaultUserRepo = new MemoryUserRepo();

// Utility functions
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (userId: number): string => {
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};

// Main service functions
export const register = async (
  email: string, 
  password: string, 
  firstName: string, 
  lastName: string,
  userRepo: UserRepo = defaultUserRepo
): Promise<AuthResult> => {
  try {
    // Check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName
    };

    const user = await userRepo.create(userData);

    // Generate token
    const token = generateToken(user.id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token
    };
  } catch (error) {
    throw error;
  }
};

export const login = async (
  email: string, 
  password: string,
  userRepo: UserRepo = defaultUserRepo
): Promise<AuthResult> => {
  try {
    // Find user by email
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken(user.id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token
    };
  } catch (error) {
    throw error;
  }
};

export const getUserById = async (
  userId: number,
  userRepo: UserRepo = defaultUserRepo
): Promise<UserWithoutPassword> => {
  try {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

// Utility function for testing
export const clearUsers = (userRepo: UserRepo = defaultUserRepo): void => {
  if (userRepo instanceof MemoryUserRepo) {
    (userRepo as MemoryUserRepo).clear();
  }
};