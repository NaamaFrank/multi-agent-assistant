// Lambda-native handler for getting and updating conversation by ID
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from '../utils/auth';
import { getRequestInfo, createSuccessResponse, createErrorResponse } from '../utils/http';
import { mapError } from '../utils/errors';
import { getConversation } from '../services/ChatService';
import { getConversationsRepo } from '../repositories/factory';

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
    if (routeKey !== 'GET /api/agent/conversations/{id}' && routeKey !== 'PUT /api/agent/conversations/{id}') {
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

    // Handle different methods
    if (routeKey === 'GET /api/agent/conversations/{id}') {
      // GET - return conversation
      return createSuccessResponse(conversation, 'Conversation retrieved successfully');
    } else {
      // PUT - update conversation
      // Parse request body
      let requestBody;
      try {
        requestBody = JSON.parse(event.body || '{}');
      } catch (error) {
        return createErrorResponse(400, 'Invalid JSON in request body');
      }

      // Validate update data
      const { title } = requestBody;
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return createErrorResponse(400, 'Title is required and must be a non-empty string');
      }

      if (title.length > 200) {
        return createErrorResponse(400, 'Title must be 200 characters or less');
      }

      // Update conversation
      const conversationsRepo = getConversationsRepo();
      await conversationsRepo.updateMeta(conversationId, {
        title: title.trim(),
      });
      
      // Return the updated conversation
      const updatedConversation = await conversationsRepo.get(conversationId);
      
      return createSuccessResponse(updatedConversation, 'Conversation updated successfully');
    }

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    const { statusCode, message } = mapError(error);
    return createErrorResponse(statusCode, message);
  }
};