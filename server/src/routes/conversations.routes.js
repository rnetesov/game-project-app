import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parseMessageAttachments } from '../middleware/message-attachments.middleware.js';
import {
  listConversations,
  openConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  downloadMessageAttachment,
} from '../controllers/conversations.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listConversations);
router.post('/', openConversation);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', parseMessageAttachments, sendMessage);
router.get('/:id/attachments/:attachmentId', downloadMessageAttachment);
router.patch('/:id/read', markConversationRead);

export default router;
