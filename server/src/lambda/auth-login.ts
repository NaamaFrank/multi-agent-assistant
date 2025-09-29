import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { authService } from '../services/AuthService';

interface LoginRequest {
  email: string;
  password: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;
  console.log(`[${requestId}] Login request started`);

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const loginData: LoginRequest = JSON.parse(event.body);
    const { email, password } = loginData;

    // Validate required fields
    if (!email || !password) {
      return createErrorResponse(400, 'Email and password are required');
    }

    // Authenticate user through service
    const result = await authService.login(email, password);

    console.log(`[${requestId}] User logged in successfully: ${email}`);

    return createSuccessResponse({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.token
      }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Login error:`, error);
    const { statusCode, message } = mapError(error);
    return createErrorResponse(statusCode, message);
  }
};