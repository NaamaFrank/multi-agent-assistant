// Lambda-native handler for conversations CRUD operations
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from '../utils/auth';
import { getRequestInfo, createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { conversationService } from '../services/ConversationService';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  const { routeKey, rawPath, method, requestId } = getRequestInfo(event);
  
  // Logging
  console.log(JSON.stringify({
    requestId,
    routeKey,
    rawPath,
    method,
    hasAuthHeader: !!(event.headers?.authorization || event.headers?.Authorization),
  }));

  try {
    // Authenticate user
    const user = await authenticate(event);

    // Route based on routeKey
    switch (routeKey) {
      case 'GET /api/agent/conversations': {
        // List conversations for user
        // Convert string userId to number
        const numericUserId = parseInt(user.id, 10);
        if (isNaN(numericUserId)) {
          return createErrorResponse(400, 'Invalid user ID');
        }
        
        const conversations = await conversationService.getConversations(numericUserId);
        return createSuccessResponse(conversations, 'Conversations retrieved successfully');
      }

      case 'POST /api/agent/conversations': {
        // Create new conversation
        let requestBody: any = {};
        try {
          if (event.body) {
            requestBody = JSON.parse(event.body);
          }
        } catch (parseError) {
          return createErrorResponse(400, 'Invalid JSON in request body');
        }

        const title = requestBody.title;
        
        // Convert string userId to number
        const numericUserId = parseInt(user.id, 10);
        if (isNaN(numericUserId)) {
          return createErrorResponse(400, 'Invalid user ID');
        }
        
        const conversationData = await conversationService.createConversation(numericUserId, title);
        
        return createSuccessResponse(conversationData, 'Conversation created successfully');
      }

      default:
        return createErrorResponse(405, `Method not allowed: ${routeKey}`);
    }

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    const { statusCode, message } = mapError(error);
    return createErrorResponse(statusCode, message);
  }
};