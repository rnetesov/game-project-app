import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));
router.patch('/me', requireAuth, asyncHandler(updateProfile));
router.get('/:username', asyncHandler(getProfile));
export default router;
