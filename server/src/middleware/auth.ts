import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, ApiResponse } from '../types';

// Extend Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const auth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        message: 'Access denied. No valid token provided.'
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      const response: ApiResponse = {
        success: false,
        message: 'Access denied. No token provided.'
      };
      res.status(401).json(response);
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as JwtPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      const response: ApiResponse = {
        success: false,
        message: 'Token expired.'
      };
      res.status(401).json(response);
      return;
    }
    
    if (error.name === 'JsonWebTokenError') {
      const response: ApiResponse = {
        success: false,
        message: 'Invalid token.'
      };
      res.status(401).json(response);
      return;
    }

    const response: ApiResponse = {
      success: false,
      message: 'Token verification failed.'
    };
    res.status(500).json(response);
  }
};