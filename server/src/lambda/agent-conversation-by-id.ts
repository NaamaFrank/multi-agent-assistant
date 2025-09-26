// Lambda-native handler for getting conversation by ID
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from '../utils/auth';
import { getRequestInfo, createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { getConversation } from '../services/ChatService';

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
    // Route validation
    if (routeKey !== 'GET /api/agent/conversations/{id}') {
      return createErrorResponse(405, `Method not allowed: ${routeKey}`);
    }

    // Authenticate user
    const user = await authenticate(event);
    
    // Validate conversation ID
    const conversationId = event.pathParameters?.id;
    if (!conversationId) {
      return createErrorResponse(400, 'Conversation ID is required');
    }

    // Get conversation and verify ownership
    const conversation = await getConversation(conversationId);
    
    if (!conversation || conversation.userId.toString() !== user.id) {
      return createErrorResponse(404, 'Conversation not found');
    }
    
    return createSuccessResponse(conversation, 'Conversation retrieved successfully');

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    const { statusCode, message } = mapError(error);
    return createErrorResponse(statusCode, message);
  }
};