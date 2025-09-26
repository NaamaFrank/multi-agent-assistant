// API Configuration 
// DIRECT TESTING MODE: Frontend makes direct requests to AWS endpoints
// This will encounter CORS errors as expected for direct testing

// 🌟 Helper to check if we're in development mode
export const isDevelopment = () => process.env.NODE_ENV === 'development';

// 🚀 DIRECT AWS URLs (for direct testing without proxy)
const DIRECT_AWS_CONFIG = {
  BASE_URL: 'https://s95ukr3uq4.execute-api.us-east-1.amazonaws.com',
  AUTH_BASE_URL: 'https://s95ukr3uq4.execute-api.us-east-1.amazonaws.com/api/auth',
  AGENT_BASE_URL: 'https://s95ukr3uq4.execute-api.us-east-1.amazonaws.com/api/agent',
  // Direct Function URL for streaming
  STREAMING_URL: 'https://fucnyzp25mvxae64uome6qjthy0mmlts.lambda-url.us-east-1.on.aws',
} as const;

// 🛠️ PROXY URLs (commented out - use for proxy mode)
const PROXY_CONFIG = {
  BASE_URL: '',
  AUTH_BASE_URL: '/api/auth',
  AGENT_BASE_URL: '/api/agent', 
  STREAMING_URL: '/agent/stream',
} as const;

// 🎯 Export direct AWS configuration for testing
export const API_CONFIG = DIRECT_AWS_CONFIG;

// Helper to get the appropriate URL based on environment  
export const getApiConfig = () => API_CONFIG;