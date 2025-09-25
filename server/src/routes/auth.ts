import express from 'express';
import { register, login, getCurrentUser, verifyToken, logout } from '../controllers';
import { auth } from '../middleware/auth';
import { 
  registerValidation, 
  loginValidation, 
  validateRequest 
} from '../middleware/validation';

const router = express.Router();

// Register endpoint
router.post('/register', registerValidation, validateRequest, register);

// Login endpoint
router.post('/login', loginValidation, validateRequest, login);

// Get current user (protected route)
router.get('/me', auth, getCurrentUser);

// Token validation endpoint
router.post('/verify-token', auth, verifyToken);

// Logout endpoint (client-side token removal)
router.post('/logout', auth, logout);

export default router;