// Jest setup file// Global test setup

process.env.NODE_ENV = 'test';import { config } from 'dotenv';



// Global setup for all tests// Load test environment variables

beforeAll(() => {config({ path: '.env.test' });

  // Setup any global test dependencies here

});// Mock AWS SDK to avoid real AWS calls during tests

jest.mock('@aws-sdk/client-dynamodb');

// Global teardownjest.mock('@aws-sdk/lib-dynamodb');

afterAll(() => {jest.mock('@aws-sdk/client-bedrock-runtime');

  // Clean up any resourcesjest.mock('@aws-sdk/client-secrets-manager');

});jest.mock('@aws-sdk/client-ssm');

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};