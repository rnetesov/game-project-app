import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createPost, deletePost, listPosts, togglePostLike,
  listPostComments, createPostComment, deletePostComment,
} from '../controllers/posts.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listPosts);
router.post('/', createPost);
router.delete('/:id', deletePost);
router.put('/:id/like', togglePostLike);
router.get('/:id/comments', listPostComments);
router.post('/:id/comments', createPostComment);
router.delete('/:id/comments/:commentId', deletePostComment);

export default router;
