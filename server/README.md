# CrossRiver Authentication Server

A secure Node.js authentication server with JWT token-based authentication.

## Features

- ✅ JWT-based authentication
- ✅ Secure password hashing with bcrypt
- ✅ Input validation and sanitization
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Security headers with Helmet
- ✅ Error handling middleware
- ✅ Unit tests with Jest
- ✅ In-memory user storage (easily replaceable with DynamoDB)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Copy .env file and update JWT_SECRET
cp .env .env.local
```

**Important**: Change the `JWT_SECRET` in your `.env` file to a secure random string for production!

### Running the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2025-09-25T10:00:00.000Z",
      "updatedAt": "2025-09-25T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2025-09-25T10:00:00.000Z",
      "updatedAt": "2025-09-25T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Current User (Protected)
```http
GET /api/auth/me
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2025-09-25T10:00:00.000Z",
      "updatedAt": "2025-09-25T10:00:00.000Z"
    }
  }
}
```

#### Verify Token (Protected)
```http
POST /api/auth/verify-token
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "userId": 1
  }
}
```

#### Logout (Protected)
```http
POST /api/auth/logout
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful. Please remove the token from client-side storage."
}
```

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-25T10:00:00.000Z",
  "uptime": 123.456
}
```

## Password Requirements

Passwords must meet the following criteria:
- At least 8 characters long
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character (@$!%*?&)

## Security Features

- **JWT Tokens**: Secure token-based authentication with configurable expiration
- **Password Hashing**: Bcrypt with configurable salt rounds (default: 12)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive validation using express-validator
- **CORS Protection**: Configurable CORS settings
- **Security Headers**: Helmet middleware for security headers
- **Error Handling**: Centralized error handling with proper status codes

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `JWT_SECRET` | Secret key for JWT tokens | **Must be set!** |
| `JWT_EXPIRES_IN` | Token expiration time | `24h` |
| `BCRYPT_ROUNDS` | Bcrypt salt rounds | `12` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

## Project Structure

```
server/
├── src/
│   ├── app.js                 # Main application file
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication middleware
│   │   ├── errorHandler.js   # Error handling middleware
│   │   └── validation.js     # Input validation middleware
│   ├── models/
│   │   └── UserStorage.js    # In-memory user storage
│   ├── routes/
│   │   └── auth.js           # Authentication routes
│   └── services/
│       └── authService.js    # Authentication business logic
├── tests/
│   ├── auth.test.js          # Authentication endpoint tests
│   ├── authService.test.js   # Auth service unit tests
│   └── health.test.js        # Health check tests
├── package.json
├── .env                      # Environment variables
├── .gitignore
└── README.md
```

## Testing

The project includes comprehensive unit tests covering:

- Authentication endpoints (register, login, protected routes)
- Authentication service methods
- Password hashing and validation
- Token generation and verification
- Error handling
- Health check endpoint

Run tests with coverage:
```bash
npm test -- --coverage
```

## Next Steps

1. **Replace In-Memory Storage**: The current implementation uses in-memory storage. For production, replace `UserStorage.js` with DynamoDB or another persistent storage solution.

2. **Add More Features**: Consider adding:
   - Password reset functionality
   - Email verification
   - Role-based access control
   - Refresh tokens
   - Account lockout after failed attempts

3. **Production Deployment**: 
   - Set strong `JWT_SECRET`
   - Configure appropriate CORS origins
   - Set up monitoring and logging
   - Use HTTPS in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License