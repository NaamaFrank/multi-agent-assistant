import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { register } from '../services/authService';

interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;
  console.log(`[${requestId}] Register request started`);

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const registerData: RegisterRequest = JSON.parse(event.body);
    const { email, password, firstName = '', lastName = '' } = registerData;

    // Validate required fields
    if (!email || !password) {
      return createErrorResponse(400, 'Email and password are required');
    }

    // Register user through service
    const result = await register(email, password, firstName, lastName);

    console.log(`[${requestId}] User registered successfully: ${email}`);

    return createSuccessResponse({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        token: result.token
      }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Register error:`, error);
    const { statusCode, message } = mapError(error);
    return createErrorResponse(statusCode, message);
  }
};