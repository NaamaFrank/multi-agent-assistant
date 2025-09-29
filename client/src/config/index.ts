import type { ApiConfig } from '@/types';

const isDevelopment = import.meta.env.DEV;

export const apiConfig: ApiConfig = {
  baseUrl: isDevelopment 
    ? '/api' // Use Vite proxy in development
    : 'https://zm66uq3qmi.execute-api.us-east-1.amazonaws.com/api',
  streamingUrl: isDevelopment
    ? 'https://g644tvwwomzjzt4gdsfzjt234i0hjlnc.lambda-url.us-east-1.on.aws'
    : 'https://g644tvwwomzjzt4gdsfzjt234i0hjlnc.lambda-url.us-east-1.on.aws',
  timeout: 30000,
};

export const STORAGE_KEYS = {
  JWT_TOKEN: 'jwt_token',
  USER_DATA: 'user_data',
  USER_PREFERENCES: 'user_preferences',
} as const;

export const STREAMING_CONFIG = {
  UPDATE_INTERVAL: 100, // UI update interval for smooth streaming (ms)
  RETRY_DELAY: 1000, // EventSource retry delay
  MAX_RETRIES: 3,
} as const;

export const UI_CONFIG = {
  MESSAGE_FADE_DURATION: 200,
  TYPING_ANIMATION_DURATION: 300,
  AUTO_SCROLL_THRESHOLD: 100, // pixels from bottom to trigger auto-scroll
} as const;