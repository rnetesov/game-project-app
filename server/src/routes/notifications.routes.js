import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notifications.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listNotifications));
router.patch('/read-all', asyncHandler(markAllNotificationsRead));
router.patch('/:id/read', asyncHandler(markNotificationRead));

export default router;
