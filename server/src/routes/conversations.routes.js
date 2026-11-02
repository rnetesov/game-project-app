import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listConversations,
  openConversation,
  listMessages,
  sendMessage,
  markConversationRead,
} from '../controllers/conversations.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listConversations);
router.post('/', openConversation);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', sendMessage);
router.patch('/:id/read', markConversationRead);

export default router;
