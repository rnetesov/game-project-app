import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createPost, deletePost, listPosts } from '../controllers/posts.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listPosts);
router.post('/', createPost);
router.delete('/:id', deletePost);

export default router;
