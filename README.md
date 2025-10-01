# CrossRiver Multi-Agent Assistant

A secure serverless multi-agent assistant built with AWS Lambda, API Gateway, DynamoDB, and Amazon Bedrock.

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
npm run dev
```

The frontend will be available at http://localhost:3000.

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

# Refresh Token
POST /api/auth/refresh
Authorization: Bearer <token>
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
│   │   ├── tools/    - Agent tools (CodeRunner, WebSearch)
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

## 👩‍💻 For Code Reviewers

### Running the Frontend Only

To review all the functionality of the application, you only need to run the frontend - no backend setup required:

```bash
# Navigate to the client directory
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be accessible at http://localhost:3000. The UI is already configured to call production APIs, so all functionality will work without a local backend.

