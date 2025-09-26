import axios from 'axios';
import { getApiConfig } from './config/api';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
  errors?: Array<{ field: string; message: string }>;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;
  private baseUrl = getApiConfig().AUTH_BASE_URL;

  constructor() {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('jwt_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem('auth_user');
      }
    }

    // Set axios default auth header if token exists
    if (this.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }
  }

  async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/register`, {
        email,
        password,
        firstName,
        lastName
      });

      if (response.data.success && response.data.data) {
        this.token = response.data.data.token;
        this.user = response.data.data.user;
        
        // Save to localStorage
        localStorage.setItem('jwt_token', this.token!);
        localStorage.setItem('auth_user', JSON.stringify(this.user));
        
        // Set axios default auth header
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      }

      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return {
        success: false,
        message: 'Network error occurred'
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/login`, {
        email,
        password
      });

      if (response.data.success && response.data.data) {
        this.token = response.data.data.token;
        this.user = response.data.data.user;
        
        // Save to localStorage
        localStorage.setItem('jwt_token', this.token!);
        localStorage.setItem('auth_user', JSON.stringify(this.user));
        
        // Set axios default auth header
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      }

      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return {
        success: false,
        message: 'Network error occurred'
      };
    }
  }

  logout(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('auth_user');
    delete axios.defaults.headers.common['Authorization'];
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }
}

export const authService = new AuthService();