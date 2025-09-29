// Lambda-native handler for messages list/append
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from '../utils/auth';
import { getRequestInfo, createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { messageService } from '../services/MessageService';
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
    
    // Get conversation ID from path
    const conversationId = event.pathParameters?.id;
    if (!conversationId) {
      return createErrorResponse(400, 'Conversation ID is required');
    }

    // Convert string userId to number
    const numericUserId = parseInt(user.id, 10);
    if (isNaN(numericUserId)) {
      return createErrorResponse(400, 'Invalid user ID');
    }

    // Verify user has access to conversation
    const conversation = await conversationService.getConversationById(conversationId, numericUserId);
    if (!conversation) {
      return createErrorResponse(404, 'Conversation not found');
    }

    // Route based on routeKey
    switch (routeKey) {
      case 'GET /api/agent/conversations/{id}/messages': {
        // List messages for conversation
        const messages = await messageService.getMessages({
          conversationId,
          userId: numericUserId
        });
        return createSuccessResponse(messages, 'Messages retrieved successfully');
      }

      case 'POST /api/agent/conversations/{id}/messages': {
        // Append message to conversation
        let requestBody: any = {};
        try {
          if (event.body) {
            requestBody = JSON.parse(event.body);
          }
        } catch (parseError) {
          return createErrorResponse(400, 'Invalid JSON in request body');
        }

        if (!requestBody.role || !requestBody.content) {
          return createErrorResponse(400, 'Role and content are required');
        }

        // Only support user messages through this endpoint 
        if (requestBody.role === 'user') {
          const message = await messageService.addMessage({
            conversationId,
            userId: numericUserId,
            content: requestBody.content,
            role: 'user'
          });
          return createSuccessResponse(message, 'Message added successfully');
        } else {
          return createErrorResponse(400, 'Only user messages can be added through this endpoint');
        }
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