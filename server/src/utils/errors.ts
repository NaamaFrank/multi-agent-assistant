// Error handling utilities for Lambda functions

export class HttpError extends Error {
  statusCode: number;
  
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

export function createHttpError(statusCode: number, message: string): HttpError {
  return new HttpError(statusCode, message);
}

export function mapError(error: any): { statusCode: number; message: string } {
  if (error.statusCode) {
    return {
      statusCode: error.statusCode,
      message: error.message || 'Request failed'
    };
  }

  // Map common error types
  if (error.name === 'ValidationError') {
    return { statusCode: 400, message: error.message };
  }
  
  if (error.name === 'UnauthorizedError' || error.message?.includes('unauthorized')) {
    return { statusCode: 401, message: 'Unauthorized' };
  }
  
  if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
    return { statusCode: 404, message: 'Not found' };
  }

  // Default to 500
  return {
    statusCode: 500,
    message: error.message || 'Internal server error'
  };
}