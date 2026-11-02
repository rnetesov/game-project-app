import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parseMessageAttachments } from '../middleware/message-attachments.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
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
router.get('/', asyncHandler(listConversations));
router.post('/', asyncHandler(openConversation));
router.get('/:id/messages', asyncHandler(listMessages));
router.post('/:id/messages', parseMessageAttachments, asyncHandler(sendMessage));
router.get('/:id/attachments/:attachmentId', asyncHandler(downloadMessageAttachment));
router.patch('/:id/read', asyncHandler(markConversationRead));

export default router;
