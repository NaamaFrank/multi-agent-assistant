import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { UserRepo, MemoryUserRepo } from '../repositories/UserRepo';
import { getUserRepo } from '../repositories/factory';
import { AuthResult, UserWithoutPassword, JwtPayload } from '../types';
import { getConfig } from '../utils/config';

// Ensure environment variables are loaded
dotenv.config();

// Utility functions
export const hashPassword = async (password: string): Promise<string> => {
  const config = await getConfig();
  return bcrypt.hash(password, config.saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = async (userId: number): Promise<string> => {
  const config = await getConfig();
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );
};

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  const config = await getConfig();
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};

// Main service functions
export const register = async (
  email: string, 
  password: string, 
  firstName: string, 
  lastName: string,
  userRepo: UserRepo = getUserRepo()
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
    const token = await generateToken(user.id);

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
  userRepo: UserRepo = getUserRepo()
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
    const token = await generateToken(user.id);

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
  userRepo: UserRepo = getUserRepo()
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
export const clearUsers = (userRepo: UserRepo = getUserRepo()): void => {
  if (userRepo instanceof MemoryUserRepo) {
    (userRepo as MemoryUserRepo).clear();
  }
};