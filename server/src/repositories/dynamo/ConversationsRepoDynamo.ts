import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ConversationsRepo } from '../ConversationsRepo';
import { Conversation } from '../../types';

export class ConversationsRepoDynamo implements ConversationsRepo {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName?: string) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName || process.env.CONVERSATIONS_TABLE || 'crossriver-dev-conversations';
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    try {
      const userId = this.extractUserIdFromConversationId(conversationId);
      
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { 
            userId: userId.toString(),
            conversationId 
          },
        })
      );
      
      return result.Item ? this.dynamoItemToConversation(result.Item) : null;
    } catch (error) {
      console.error('Error finding conversation by id:', error);
      throw new Error('Failed to find conversation by id');
    }
  }

  async get(conversationId: string): Promise<Conversation | null> {
    return this.findById(conversationId);
  }

  async listByUser(userId: number): Promise<Conversation[]> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId.toString(),
          },
          ScanIndexForward: false, // Latest first
        })
      );
      
      return result.Items ? result.Items.map((item: any) => this.dynamoItemToConversation(item)) : [];
    } catch (error) {
      console.error('Error finding conversations by user id:', error);
      throw new Error('Failed to find conversations by user id');
    }
  }

  async create(userId: number, title?: string): Promise<Conversation> {
    try {
      const conversationId = `conv_${userId}_${Date.now()}`;
      const now = new Date().toISOString();
      
      const conversation: Conversation = {
        conversationId,
        userId,
        title: title || 'New Conversation',
        createdAt: new Date(now),
        lastMessageAt: new Date(now),
      };

      const dynamoItem = this.conversationToDynamoItem(conversation);

      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
          ConditionExpression: 'attribute_not_exists(conversationId)',
        })
      );

      return conversation;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Conversation with this ID already exists');
      }
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  async updateMeta(conversationId: string, updates: Partial<Conversation>): Promise<void> {
    try {
      // Get existing conversation first
      const existing = await this.findById(conversationId);
      if (!existing) {
        return;
      }

      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'conversationId' && key !== 'userId' && key !== 'createdAt') {
          const valueKey = `:${key}`;
          const nameKey = `#${key}`;
          updateExpressions.push(`${nameKey} = ${valueKey}`);
          
          if (value instanceof Date) {
            expressionAttributeValues[valueKey] = value.toISOString();
          } else {
            expressionAttributeValues[valueKey] = value;
          }
          
          expressionAttributeNames[nameKey] = key;
        }
      });

      if (updateExpressions.length === 0) {
        return;
      }

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { 
            userId: existing.userId.toString(),
            conversationId: existing.conversationId
          },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
        })
      );
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw new Error('Failed to update conversation');
    }
  }

  async delete(conversationId: string): Promise<boolean> {
    try {
      const existing = await this.findById(conversationId);
      if (!existing) {
        return false;
      }

      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { 
            userId: existing.userId.toString(),
            conversationId 
          },
        })
      );

      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  async updateLastMessageAt(conversationId: string, timestamp: Date): Promise<void> {
    try {
      const existing = await this.findById(conversationId);
      if (!existing) {
        throw new Error('Conversation not found');
      }

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { 
            userId: existing.userId.toString(),
            conversationId 
          },
          UpdateExpression: 'SET lastMessageAt = :timestamp',
          ExpressionAttributeValues: {
            ':timestamp': timestamp.toISOString(),
          },
        })
      );
    } catch (error) {
      console.error('Error updating last message timestamp:', error);
      throw new Error('Failed to update last message timestamp');
    }
  }

  private conversationToDynamoItem(conversation: Conversation): any {
    return {
      userId: conversation.userId.toString(), // Partition key
      conversationId: conversation.conversationId, // Sort key
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    };
  }

  private dynamoItemToConversation(item: any): Conversation {
    return {
      conversationId: item.conversationId,
      userId: parseInt(item.userId),
      title: item.title,
      createdAt: new Date(item.createdAt),
      lastMessageAt: new Date(item.lastMessageAt),
    };
  }

  private extractUserIdFromConversationId(conversationId: string): number {
    // Assuming conversationId format is "conv_{userId}_{timestamp}"
    const parts = conversationId.split('_');
    if (parts.length >= 2) {
      return parseInt(parts[1]);
    }
    throw new Error('Invalid conversationId format');
  }
}