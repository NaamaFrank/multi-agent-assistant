import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../utils/http';
import { ConversationsRepoDynamo } from '../repositories/dynamo/ConversationsRepoDynamo';
import { MessagesRepoDynamo } from '../repositories/dynamo/MessagesRepoDynamo';
import { authenticate } from '../utils/auth';
import { mapError } from '../utils/errors';

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

    // Get repository instances (using concrete DynamoDB implementations)
    const conversationsRepo = new ConversationsRepoDynamo(
      process.env.CONVERSATIONS_TABLE || 'crossriver-dev-conversations'
    );
    const messagesRepo = new MessagesRepoDynamo(
      process.env.MESSAGES_TABLE || 'crossriver-dev-messages'
    );

    // Verify the conversation belongs to the user
    const conversation = await conversationsRepo.findById(conversationId);
    if (!conversation) {
      return createErrorResponse(404, 'Conversation not found');
    }

    if (conversation.userId !== userId) {
      return createErrorResponse(403, 'Access denied: conversation belongs to another user');
    }

    // Delete all messages in the conversation first
    try {
      const messages = await messagesRepo.listByConversation(conversationId);
      console.log(`Deleting ${messages.length} messages for conversation ${conversationId}`);
      
      for (const message of messages) {
        await messagesRepo.delete(message.messageId);
      }
      
      console.log('All messages deleted successfully');
    } catch (error) {
      console.error('Error deleting messages:', error);
      // Continue with conversation deletion even if message deletion fails
    }

    // Delete the conversation
    const deleted = await conversationsRepo.delete(conversationId);
    
    if (!deleted) {
      return createErrorResponse(500, 'Failed to delete conversation');
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