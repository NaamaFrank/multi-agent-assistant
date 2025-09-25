import { query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const streamValidation = [
  query('message')
    .notEmpty()
    .withMessage('Message is required')
    .trim()
    .isLength({ max: parseInt(process.env.MAX_PROMPT_CHARS || '8000') })
    .withMessage(`Message must not exceed ${process.env.MAX_PROMPT_CHARS || 8000} characters`),
  query('conversationId')
    .optional()
    .isString()
    .withMessage('ConversationId must be a string'),
  query('agentHint')
    .optional()
    .isString()
    .withMessage('AgentHint must be a string')
];

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? (error as any).path : 'unknown',
        message: error.msg
      }))
    };
    res.status(400).json(response);
    return;
  }
  next();
};