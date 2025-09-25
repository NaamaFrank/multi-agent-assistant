import { Router } from 'express';
import { auth } from '../middleware/auth';
import { streamValidation, handleValidationErrors } from '../middleware/streamValidation';
import { streamChat, createConversation, getConversations, getConversationById, getConversationMessages } from '../controllers';

const router = Router();

// Streaming endpoint
router.get('/stream', 
  auth, 
  streamValidation, 
  handleValidationErrors,
  streamChat
);

// Non-stream endpoints for UI
router.post('/conversations', auth, createConversation);

// Get all conversations for current user
router.get('/conversations', auth, getConversations);

// Get specific conversation
router.get('/conversations/:id', auth, getConversationById);

// Get messages for a conversation
router.get('/conversations/:id/messages', auth, getConversationMessages);

export default router;