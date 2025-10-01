import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthState, LoginCredentials, RegisterCredentials } from '@/types';
import { apiService } from '@/services';
import { STORAGE_KEYS } from '@/config';
import { useToast } from './use-toast';
import { authTokenService } from '@/lib/auth-token';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);
  
  // Listen for unauthorized events (401 errors)
  useEffect(() => {
    const handleUnauthorized = async () => {
      // Only try to refresh if we're authenticated
      if (state.isAuthenticated) {
        console.log('Unauthorized request detected, attempting token refresh');
        const success = await refreshToken();
        
        // If refresh failed, log the user out
        if (!success) {
          console.log('Token refresh failed, logging out');
          logout();
        }
      }
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [state.isAuthenticated]);

  const refreshToken = async (): Promise<boolean> => {
    try {
      const currentToken = localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
      if (!currentToken) {
        return false;
      }
      
      const response = await apiService.refreshToken({ token: currentToken });
      
      if (response.success && response.data) {
        const { token, user } = response.data;
        
        // Store auth data
        localStorage.setItem(STORAGE_KEYS.JWT_TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        
        // Update state with new token
        setState(prevState => ({
          ...prevState,
          token,
          user,
          isAuthenticated: true
        }));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      if (!token || !userData) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Validate token and refresh if needed
      if (!authTokenService.isTokenValid()) {
        const success = await refreshToken();
        
        if (!success) {
          throw new Error('Token refresh failed');
        }
      }

      // Parse stored user data
      const user = JSON.parse(userData);
      setState({
        user,
        token,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
    } catch (error) {
      // Clear invalid data
      localStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      
      setState({
        user: null,
        token: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
      });
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store auth data
        localStorage.setItem(STORAGE_KEYS.JWT_TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        
        setState({
          user,
          token,
          isLoading: false,
          error: null,
          isAuthenticated: true,
        });

        toast({
          title: 'Welcome back!',
          description: `Logged in as ${user.email}`,
        });
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      
      toast({
        title: 'Login failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await apiService.register(credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store auth data
        localStorage.setItem(STORAGE_KEYS.JWT_TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        
        setState({
          user,
          token,
          isLoading: false,
          error: null,
          isAuthenticated: true,
        });

        toast({
          title: 'Account created!',
          description: `Welcome ${user.firstName}`,
        });
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      
      toast({
        title: 'Registration failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    
    // Update state
    setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });

    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out',
    });
  };

  const refreshAuth = async () => {
    // Check if token is valid, refresh if needed
    if (!authTokenService.isTokenValid()) {
      return await refreshToken();
    }
    return true;
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}