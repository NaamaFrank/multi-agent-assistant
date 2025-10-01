import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { authService } from '../services/AuthService';

interface TokenRefreshRequest {
  token: string;
}

/**
 * Lambda handler for refreshing authentication tokens
 * Verifies the existing token and if valid, issues a new one with an extended expiration
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;
  console.log(`[${requestId}] Token refresh request started`);

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const refreshData: TokenRefreshRequest = JSON.parse(event.body);
    const { token } = refreshData;

    // Validate required fields
    if (!token) {
      return createErrorResponse(400, 'Token is required');
    }

    try {
      // Verify the existing token - this will throw if token is invalid
      const payload = await authService.verifyToken(token);
      
      // Get user data to ensure the user still exists
      const user = await authService.getUserById(payload.userId);
      
      // Generate new token with extended expiration
      // Use the AuthService's token generation method for consistency
      const newToken = await authService.refreshToken(user.id);

      console.log(`[${requestId}] Token refreshed successfully for user ID: ${user.id}`);

      return createSuccessResponse({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user,
          token: newToken
        }
      });
    } catch (error: any) {
      // Handle specific token verification errors
      if (error.name === 'TokenExpiredError') {
        return createErrorResponse(401, 'Token has expired, please login again');
      }
      
      if (error.name === 'JsonWebTokenError') {
        return createErrorResponse(401, 'Invalid token, please login again');
      }
      
      throw error; // Let the outer catch handle other errors
    }
  } catch (error: any) {
    console.error(`[${requestId}] Token refresh error:`, error);
    const { statusCode, message } = mapError(error);
    return createErrorResponse(statusCode, message);
  }
};
