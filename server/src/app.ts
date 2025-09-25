import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import authRoutes from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { ApiResponse } from './types';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse<{
    status: string;
    timestamp: string;
    uptime: number;
  }> = {
    success: true,
    message: 'Server is healthy',
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  };
  res.status(200).json(response);
});

// Routes
app.use('/api/auth', authRoutes);

// Error handling middleware (should be last)
app.use(errorHandler);

// Handle 404
app.use('*', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    message: 'Route not found'
  };
  res.status(404).json(response);
});

const PORT = parseInt(process.env.PORT || '3001');

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    server.close(() => {
      console.log('Process terminated');
    });
  });
}

export default app;