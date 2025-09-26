import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { UserRepo } from '../UserRepo';
import { User, CreateUserData } from '../../types';

export class UsersRepoDynamo implements UserRepo {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName?: string) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName || process.env.USERS_TABLE || 'crossriver-dev-users';
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { email },
        })
      );
      
      return result.Item ? this.dynamoItemToUser(result.Item) : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error('Failed to find user by email');
    }
  }

  async findById(id: number): Promise<User | null> {
    try {
      // We need to scan since id is not our partition key
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'id = :id',
          ExpressionAttributeValues: {
            ':id': id,
          },
        })
      );
      
      if (result.Items && result.Items.length > 0) {
        return this.dynamoItemToUser(result.Items[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Error finding user by id:', error);
      throw new Error('Failed to find user by id');
    }
  }

  async create(userData: CreateUserData): Promise<User> {
    try {
      // Generate a unique ID (timestamp + random)
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const now = new Date().toISOString();
      
      const user: User = {
        id,
        ...userData,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };

      const dynamoItem = this.userToDynamoItem(user);

      // Use conditional put to ensure email uniqueness
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
          ConditionExpression: 'attribute_not_exists(email)',
        })
      );

      return user;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User with this email already exists');
      }
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async update(id: number, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    try {
      // First find the user to get their email (partition key)
      const existingUser = await this.findById(id);
      if (!existingUser) {
        return null;
      }

      const updatedAt = new Date().toISOString();
      const updateData = { ...updates, updatedAt: new Date(updatedAt) };

      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'createdAt' && key !== 'email') {
          const valueKey = `:${key}`;
          const nameKey = `#${key}`;
          updateExpressions.push(`${nameKey} = ${valueKey}`);
          expressionAttributeValues[valueKey] = key === 'updatedAt' ? (value instanceof Date ? value.toISOString() : value) : value;
          expressionAttributeNames[nameKey] = key;
        }
      });

      if (updateExpressions.length === 0) {
        return existingUser;
      }

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { email: existingUser.email },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
        })
      );

      // Return updated user
      return { ...existingUser, ...updateData };
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      // First find the user to get their email (partition key)
      const user = await this.findById(id);
      if (!user) {
        return false;
      }

      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { email: user.email },
        })
      );

      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
        })
      );

      return result.Items ? result.Items.map(item => this.dynamoItemToUser(item)) : [];
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get all users');
    }
  }

  async exists(email: string): Promise<boolean> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { email },
          ProjectionExpression: 'email',
        })
      );
      
      return !!result.Item;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      throw new Error('Failed to check if user exists');
    }
  }

  private userToDynamoItem(user: User): any {
    return {
      email: user.email, // Partition key
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private dynamoItemToUser(item: any): User {
    return {
      id: item.id,
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      password: item.password,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    };
  }
}