import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parsePostMultipart } from '../middleware/post-upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createPost, updatePost, deletePost, getPost, listPosts,
  listPostComments, createPostComment, deletePostComment, togglePostReaction, listPostReactions,
} from '../controllers/posts.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listPosts));
router.post('/', parsePostMultipart, asyncHandler(createPost));
router.patch('/:id', parsePostMultipart, asyncHandler(updatePost));
router.delete('/:id', asyncHandler(deletePost));
router.put('/:id/reactions', asyncHandler(togglePostReaction));
router.get('/:id/reactions', asyncHandler(listPostReactions));
router.get('/:id', asyncHandler(getPost));
router.get('/:id/comments', asyncHandler(listPostComments));
router.post('/:id/comments', asyncHandler(createPostComment));
router.delete('/:id/comments/:commentId', asyncHandler(deletePostComment));

export default router;
