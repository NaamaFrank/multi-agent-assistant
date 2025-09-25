import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { ApiResponse, AuthResult, UserWithoutPassword } from '../types';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    const result: AuthResult = await authService.register(email, password, firstName, lastName);
    
    const response: ApiResponse<AuthResult> = {
      success: true,
      message: 'User registered successfully',
      data: result
    };
    
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message
    };
    res.status(400).json(response);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const result: AuthResult = await authService.login(email, password);
    
    const response: ApiResponse<AuthResult> = {
      success: true,
      message: 'Login successful',
      data: result
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message
    };
    res.status(401).json(response);
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user: UserWithoutPassword = await authService.getUserById(req.user!.userId);
    
    const response: ApiResponse<{ user: UserWithoutPassword }> = {
      success: true,
      message: 'User retrieved successfully',
      data: { user }
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message
    };
    res.status(404).json(response);
  }
};

export const verifyToken = async (req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<{ userId: number }> = {
    success: true,
    message: 'Token is valid',
    data: {
      userId: req.user!.userId
    }
  };
  res.status(200).json(response);
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const response: ApiResponse = {
    success: true,
    message: 'Logout successful. Please remove the token from client-side storage.'
  };
  res.status(200).json(response);
};