# CrossRiver Multi-Agent Assistant

A secure serverless multi-agent assistant built with AWS Lambda, API Gateway, DynamoDB, and Amazon Bedrock.

## 📋 Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Security](#security)
- [API Reference](#api-reference)
- [Development](#development)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │   Lambda        │
│   (React)       │◄──►│   HTTP API       │◄──►│   Functions     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐             │
│   Lambda        │    │   Amazon         │             │
│   Function URL  │◄──►│   Bedrock        │◄────────────┘
│   (Streaming)   │    │   (Claude 3.5)   │
└─────────────────┘    └──────────────────┘             │
         │                                               │
         │              ┌──────────────────┐             │
         └─────────────►│   DynamoDB       │◄────────────┘
                        │   Tables         │
                        │   - Users        │
                        │   - Conversations│
                        │   - Messages     │
                        └──────────────────┘
```

### AWS Services
- **AWS Lambda** - Serverless compute for all API endpoints
- **API Gateway HTTP API** - RESTful API with JWT authentication
- **Lambda Function URL** - Direct streaming endpoint for real-time chat
- **DynamoDB** - NoSQL database with on-demand scaling
- **Amazon Bedrock** - AI service (Claude 3.5 Haiku)
- **AWS Secrets Manager** - Secure JWT secret management
- **Systems Manager Parameter Store** - Configuration management

## ✨ Features

- ✅ **Pure Lambda Architecture** - No Express server overhead
- ✅ **Secure JWT Authentication** - AWS Secrets Manager integration
- ✅ **Real-time Streaming** - Server-Sent Events for AI responses
- ✅ **Multi-Agent Support** - Extensible agent framework
- ✅ **Conversation Memory** - Persistent chat history
- ✅ **Auto-scaling** - Serverless with DynamoDB on-demand
- ✅ **Security Best Practices** - IAM least privilege, encrypted secrets

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with appropriate credentials
- CDK CLI: `npm install -g aws-cdk`
- Node.js 20+

### 1. Deploy Infrastructure
```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy
```

### 2. Build & Deploy Lambda Functions
```bash
cd ../server
npm install
npm run build:lambda
# CDK deploy will automatically package Lambda functions
```

### 3. Start Frontend
```bash
cd ../client
npm install
npm start
```

## 🚀 Deployment

### Environment Setup
```bash
# Install dependencies
cd server && npm install
cd ../infra && npm install

# Build Lambda functions
cd ../server && npm run build:lambda

# Deploy infrastructure
cd ../infra && npx cdk deploy
```

### Environment Variables (Lambda)
CDK automatically configures these environment variables for Lambda functions:
```env
JWT_SECRET_ARN=arn:aws:secretsmanager:region:account:secret:name
USERS_TABLE=crossriver-prod-users
CONVERSATIONS_TABLE=crossriver-prod-conversations
MESSAGES_TABLE=crossriver-prod-messages
BEDROCK_REGION=us-east-1
MODEL_ID_PARAM=/crossriver/prod/model-id
```

### Cost Estimation
Estimated monthly cost for moderate usage (10K requests, 1M tokens):
- Lambda: ~$5
- DynamoDB: ~$10  
- Bedrock: ~$15
- API Gateway: ~$3
- **Total: ~$33/month**

## 🔐 Security

### JWT Secret Management
- **AWS Secrets Manager** stores auto-generated 64-character JWT secrets
- **No hardcoded secrets** anywhere in the codebase
- **Automatic secret rotation** ready
- **Environment isolation** - different secrets per environment

### Security Implementation
```typescript
// CDK automatically creates secure JWT secret
const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
  secretName: `/crossriver/${environment}/jwt-secret`,
  generateSecretString: {
    secretStringTemplate: '{}',
    generateStringKey: 'secret',
    passwordLength: 64,
  },
});
```

### IAM Permissions (Least Privilege)
- **DynamoDB** - Only access to specific tables
- **Bedrock** - Only Claude model access
- **Secrets Manager** - Only JWT secret access
- **SSM** - Only configuration parameters

## 📡 API Reference

### Authentication
```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Conversations
```bash
# List conversations
GET /api/agent/conversations
Authorization: Bearer <token>

# Create conversation
POST /api/agent/conversations
Authorization: Bearer <token>
{
  "title": "New Chat"
}

# Get messages
GET /api/agent/conversations/{id}/messages
Authorization: Bearer <token>
```

### Streaming Chat
```bash
# Real-time streaming
GET /api/agent/stream?message=Hello&conversationId=conv_123
Authorization: Bearer <token>
```

### Server-Sent Events Format
```
event: meta
data: {"conversationId":"conv_123","userMessageId":"msg_1","assistantMessageId":"msg_2"}

event: chunk  
data: {"delta":"Hello"}

event: done
data: {"usage":{"inputTokens":10,"outputTokens":15},"durationMs":1200}
```

## 🔧 Development

### Project Structure
```
├── client/           - React frontend
├── server/           - Lambda functions & services
│   ├── src/
│   │   ├── lambda/   - Lambda handlers
│   │   ├── services/ - Business logic
│   │   ├── repositories/ - Data access
│   │   ├── adapters/ - LLM adapters
│   │   ├── types/    - TypeScript types
│   │   └── utils/    - Utilities
│   └── scripts/      - Build scripts
└── infra/           - CDK infrastructure
```

### Lambda Functions
- `auth-register.ts` - User registration
- `auth-login.ts` - User authentication  
- `agent-conversations.ts` - Conversation management
- `agent-messages.ts` - Message operations
- `agent-stream.ts` - Real-time streaming

### Local Testing
```bash
# Test Lambda functions directly
cd server
node test-lambdas.js

# Test streaming
node test-streaming.js

# Run unit tests
npm test
```

### Build Commands
```bash
# Build TypeScript
npm run build

# Build Lambda functions
npm run build:lambda

# Deploy infrastructure
cd ../infra && npx cdk deploy
```

## 🗄️ Database Schema

### Users Table
```
Partition Key: email (string)
Attributes: id, firstName, lastName, password, createdAt, updatedAt
```

### Conversations Table  
```
Partition Key: userId (string)
Sort Key: conversationId (string)
Attributes: title, createdAt, lastMessageAt
```

### Messages Table
```
Partition Key: conversationId (string)
Sort Key: messageId (string)
Attributes: ts, role, content, status
GSI: conversationId-ts-index (for timestamp sorting)
```

## 🔍 Monitoring

### CloudWatch Metrics
- Lambda function duration, errors, throttles
- DynamoDB read/write capacity and throttling
- API Gateway request count, latency, errors

### Logging
- Structured logging with request IDs
- No PII in logs
- Error stack traces (non-production)

## 🛠️ Troubleshooting

### Common Issues

**Lambda Cold Starts**
- Symptom: First request slow (>3s)
- Solution: Consider provisioned concurrency for production

**JWT Token Issues**
- Symptom: 401 Unauthorized  
- Solution: Check AWS Secrets Manager secret for JWT configuration

**CORS Errors**
- Symptom: Browser blocks requests
- Solution: Update CORS origins in CDK stack

**Bedrock Access Denied**
- Symptom: 403 Forbidden from Bedrock
- Solution: Enable model access in AWS Console > Bedrock > Model Access

## 📝 License

This project is private and proprietary.

---

**Status: ✅ Production Ready**

The CrossRiver Multi-Agent Assistant is a secure, scalable, serverless application ready for production deployment with enterprise-grade security practices.