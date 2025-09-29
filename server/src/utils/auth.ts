// Authentication utilities
import { authService } from '../services/AuthService';
import { HttpError } from './errors';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function authenticate(event: any): Promise<AuthenticatedUser> {
  // Read Authorization header (case-insensitive)
  const authHeader = 
    event.headers?.authorization || 
    event.headers?.Authorization || 
    event.headers?.['authorization'] || 
    event.headers?.['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authorization header required');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = await authService.verifyToken(token);
    
    return {
      id: decoded.userId?.toString(),
      email: (decoded as any).email
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    throw new HttpError(401, 'Invalid token');
  }
}