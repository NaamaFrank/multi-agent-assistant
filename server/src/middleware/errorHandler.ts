import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ValidationError } from '../types';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, any>;
  errors?: Record<string, { message: string }>;
}

export const errorHandler = (
  err: CustomError, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors: ValidationError[] = Object.values(err.errors || {}).map(val => ({
      field: 'unknown',
      message: val.message
    }));
    const response: ApiResponse<never> = {
      success: false,
      message: 'Validation Error',
      errors
    };
    res.status(400).json(response);
    return;
  }

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const response: ApiResponse = {
      success: false,
      message: `${field} already exists`
    };
    res.status(400).json(response);
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid token'
    };
    res.status(401).json(response);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const response: ApiResponse = {
      success: false,
      message: 'Token expired'
    };
    res.status(401).json(response);
    return;
  }

  // Default error
  const response: ApiResponse = {
    success: false,
    message: err.message || 'Internal Server Error'
  };
  res.status(err.statusCode || 500).json(response);
};