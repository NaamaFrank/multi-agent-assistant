import { jwtDecode } from 'jwt-decode';
import { STORAGE_KEYS } from '@/config';

interface DecodedToken {
  userId: string;
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
}

/**
 * Simple JWT token validation service
 */
class AuthTokenService {
  /**
   * Get the current token from storage
   */
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
  }

  /**
   * Get user info from the token without validation
   */
  getUserInfo(): { userId: string } | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const decoded = this.decodeToken(token);
      return {
        userId: decoded.userId
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if the token is valid (not expired)
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decoded = this.decodeToken(token);
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired
      return decoded.exp > currentTime;
    } catch (error) {
      console.error('Invalid token:', error);
      return false;
    }
  }

  /**
   * Decode the token to access its payload
   */
  private decodeToken(token: string): DecodedToken {
    return jwtDecode<DecodedToken>(token);
  }
}

// Export singleton instance
export const authTokenService = new AuthTokenService();