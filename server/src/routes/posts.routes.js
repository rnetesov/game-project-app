import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parsePostMultipart } from '../middleware/post-upload.middleware.js';
import {
  createPost, updatePost, deletePost, listPosts, togglePostLike,
  listPostComments, createPostComment, deletePostComment, togglePostReaction, listPostReactions,
} from '../controllers/posts.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listPosts);
router.post('/', parsePostMultipart, createPost);
router.patch('/:id', parsePostMultipart, updatePost);
router.delete('/:id', deletePost);
router.put('/:id/reactions', togglePostReaction);
router.get('/:id/reactions', listPostReactions);
router.get('/:id/comments', listPostComments);
router.post('/:id/comments', createPostComment);
router.delete('/:id/comments/:commentId', deletePostComment);

export default router;
