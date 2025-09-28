import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { MessagesRepo } from '../MessagesRepo';
import { Message } from '../../types';

export interface MessageTS {
  messageId: string;
  conversationId: string;
  ts: string | Date;
  role: 'user' | 'assistant' | 'tool';
  agent?: string;
  content: string;
  status: 'complete' | 'interrupted' | 'error';
}

export class MessagesRepoDynamo implements MessagesRepo {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName?: string) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName || process.env.MESSAGES_TABLE || 'crossriver-dev-messages';
  }

  async append(message: Omit<Message, 'messageId' | 'ts'>): Promise<Message> {
    try {
      const messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const ts = new Date();
      
      const fullMessage: Message = {
        ...message,
        messageId,
        ts,
      };

      const dynamoItem = this.messageToDynamoItem(fullMessage);

      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
        })
      );

      return fullMessage;
    } catch (error) {
      console.error('Error appending message:', error);
      throw new Error('Failed to append message');
    }
  }

  async list(conversationId: string, options?: { limit?: number; before?: Date }): Promise<Message[]> {
    try {
      const queryParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: 'conversationId = :conversationId',
        ExpressionAttributeValues: {
          ':conversationId': conversationId,
        },
        ScanIndexForward: true, // Chronological order
      };

      if (options?.limit) {
        queryParams.Limit = options.limit;
      }

      if (options?.before) {
        queryParams.KeyConditionExpression += ' AND ts < :before';
        queryParams.ExpressionAttributeValues[':before'] = options.before.toISOString();
      }

      const result = await this.docClient.send(new QueryCommand(queryParams));
      
      return result.Items ? result.Items.map((item: any) => this.dynamoItemToMessage(item)) : [];
    } catch (error) {
      console.error('Error listing messages:', error);
      throw new Error('Failed to list messages');
    }
  }

  async update(messageId: string, updates: Partial<Message>): Promise<void> {
    try {
      // First, get the message to find the conversation ID
      const existingMessage = await this.get(messageId);
      if (!existingMessage) {
        throw new Error('Message not found');
      }
      
      const conversationId = existingMessage.conversationId;
      
      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'messageId' && key !== 'conversationId') {
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
            conversationId,
            messageId 
          },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
        })
      );
    } catch (error) {
      console.error('Error updating message:', error);
      throw new Error('Failed to update message');
    }
  }

  async create(message: Message): Promise<Message> {
    try {
      const dynamoItem = this.messageToDynamoItem(message);

      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
          ConditionExpression: 'attribute_not_exists(messageId)',
        })
      );

      return message;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Message with this ID already exists');
      }
      console.error('Error creating message:', error);
      throw new Error('Failed to create message');
    }
  }

  async get(messageId: string): Promise<Message | null> {
    try {
      // Since we can't reliably extract conversationId from messageId,
      // we'll use a scan to find the message
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          FilterExpression: 'messageId = :messageId',
          ExpressionAttributeValues: {
            ':messageId': messageId,
          },
        })
      );

      return result.Items && result.Items.length > 0 ? this.dynamoItemToMessage(result.Items[0]) : null;
    } catch (error) {
      console.error('Error getting message:', error);
      return null; // Don't throw, return null instead to avoid breaking update
    }
  }

  async updateContent(messageId: string, content: string): Promise<void> {
    try {
      // First, find the message to get its conversation ID
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'messageId = :messageId',
          ExpressionAttributeValues: {
            ':messageId': messageId,
          },
          Limit: 1
        })
      );

      if (!result.Items || result.Items.length === 0) {
        console.error('Message not found for update:', messageId);
        return; // Don't throw, just return silently
      }

      const conversationId = result.Items[0].conversationId as string;
      
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { 
            conversationId,
            messageId 
          },
          UpdateExpression: 'SET content = :content',
          ExpressionAttributeValues: {
            ':content': content,
          },
        })
      );
    } catch (error) {
      console.error('Error updating message content:', error);
      // Don't throw to avoid breaking the streaming - log and continue
    }
  }

  async updateStatus(messageId: string, status: 'complete' | 'interrupted' | 'error'): Promise<void> {
    try {
      const conversationId = this.extractConversationIdFromMessageId(messageId);
      
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { 
            conversationId,
            messageId 
          },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': status,
          },
        })
      );
    } catch (error) {
      console.error('Error updating message status:', error);
      throw new Error('Failed to update message status');
    }
  }

  async listByConversation(conversationId: string): Promise<Message[]> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'conversationId = :conversationId',
          ExpressionAttributeValues: {
            ':conversationId': conversationId,
          },
          ScanIndexForward: true, // Chronological order
        })
      );
      
      return result.Items ? result.Items.map((item: any) => this.dynamoItemToMessage(item)) : [];
    } catch (error) {
      console.error('Error listing messages by conversation:', error);
      throw new Error('Failed to list messages by conversation');
    }
  }

  async listByConversationWithPagination(
    conversationId: string, 
    limit?: number, 
    cursor?: string
  ): Promise<{ messages: Message[]; nextCursor?: string }> {
    try {
      const queryParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: 'conversationId = :conversationId',
        ExpressionAttributeValues: {
          ':conversationId': conversationId,
        },
        ScanIndexForward: false, // Latest first for pagination
      };

      if (limit) {
        queryParams.Limit = limit;
      }

      if (cursor) {
        // Decode cursor to get the last key
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      }

      const result = await this.docClient.send(new QueryCommand(queryParams));
      
      const messages = result.Items ? result.Items.map((item: any) => this.dynamoItemToMessage(item)) : [];
      
      let nextCursor: string | undefined;
      if (result.LastEvaluatedKey) {
        nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
      }

      return { messages, nextCursor };
    } catch (error) {
      console.error('Error listing messages with pagination:', error);
      throw new Error('Failed to list messages with pagination');
    }
  }

  async delete(messageId: string): Promise<boolean> {
    try {
      const conversationId = this.extractConversationIdFromMessageId(messageId);
      
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { 
            conversationId,
            messageId 
          },
        })
      );

      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error('Failed to delete message');
    }
  }

  private messageToDynamoItem(message: Message): any {
    return {
      conversationId: message.conversationId, // Partition key
      messageId: message.messageId, // Sort key
      ts: message.ts instanceof Date ? message.ts.toISOString() : message.ts, // Handle both Date and string
      role: message.role,
      agent: message.agent,
      content: message.content,
      status: message.status,
    };
  }

  private dynamoItemToMessage(item: any): Message {
    return {
      messageId: item.messageId,
      conversationId: item.conversationId,
      ts: typeof item.ts === 'string' ? new Date(item.ts) : item.ts,
      role: item.role,
      agent: item.agent,
      content: item.content,
      status: item.status,
    };
  }

  private extractConversationIdFromMessageId(messageId: string): string {
    // Assuming messageId format is "msg_{userId}_{timestamp}" and conversationId is "conv_{userId}_{timestamp}"
    const parts = messageId.split('_');
    if (parts.length >= 3) {
      return `conv_${parts[1]}_${parts[2].split('_')[0]}`;
    }
    throw new Error('Invalid messageId format');
  }
}