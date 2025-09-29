import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../utils/http';
import { authenticate } from '../utils/auth';
import { mapError } from '../utils/errors';
import { conversationService } from '../services/ConversationService';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  console.log('Delete conversation handler invoked', { 
    method: event.requestContext.http.method, 
    pathParameters: event.pathParameters 
  });

  try {
    // Extract conversation ID from path parameters
    const conversationId = event.pathParameters?.conversationId;
    if (!conversationId) {
      return createErrorResponse(400, 'Conversation ID is required');
    }

    // Authenticate user
    const user = await authenticate(event);
    const userId = parseInt(user.id);
    console.log('Delete conversation request:', { conversationId, userId });

    if (isNaN(userId)) {
      return createErrorResponse(400, 'Invalid user ID');
    }

    // Use service to delete conversation
    const deleted = await conversationService.deleteConversation(conversationId, userId);
    
    if (!deleted) {
      return createErrorResponse(404, 'Conversation not found or access denied');
    }

    console.log('Conversation deleted successfully:', conversationId);

    return createSuccessResponse({
      message: 'Conversation deleted successfully',
      conversationId
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    return createErrorResponse(500, mapError(error).message);
  }
};