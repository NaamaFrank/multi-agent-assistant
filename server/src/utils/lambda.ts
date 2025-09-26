// Lambda response utilities following AWS best practices
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse } from '../types';

export const createSuccessResponse = <T = any>(
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): APIGatewayProxyResult => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
};

export const createErrorResponse = (
  error: any,
  defaultMessage: string = 'Request failed'
): APIGatewayProxyResult => {
  const statusCode = error.statusCode || 500;
  const message = error.message || defaultMessage;

  const response: ApiResponse = {
    success: false,
    message,
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
};

export const createValidationErrorResponse = (
  message: string = 'Validation failed',
  statusCode: number = 400
): APIGatewayProxyResult => {
  return createErrorResponse({ message, statusCode }, message);
};