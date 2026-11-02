import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));
router.patch('/me', requireAuth, updateProfile);
router.get('/:username', getProfile);
export default router;
