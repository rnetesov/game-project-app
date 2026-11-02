import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { createNotification } from '../utils/notifications.js';
import {
  removePostImageFiles,
  removeUploadedFiles,
} from '../middleware/post-upload.middleware.js';

const postSelect = {
  id: true,
  content: true,
  authorId: true,
  createdAt: true,
  author: { select: { id: true, username: true, avatarUrl: true } },
  images: { select: { id: true, url: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
  _count: { select: { likes: true, comments: true } },
};

export async function listPosts(req, res, next) {
  const parsed = z.object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(30).default(10),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Некорректные параметры ленты' });

  try {
    const { cursor, limit } = parsed.data;
    const rows = await prisma.post.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { ...postSelect, likes: { where: { userId: req.user.id }, select: { id: true } } },
    });
    const hasMore = rows.length > limit;
    const posts = (hasMore ? rows.slice(0, limit) : rows).map(({ likes, ...post }) => ({
      ...post, likedByMe: likes.length > 0,
    }));
    res.json({ success: true, posts, nextCursor: hasMore ? posts[posts.length - 1].id : null });
  } catch (error) { next(error); }
}

export async function createPost(req, res, next) {
  const files = req.files || [];
  const parsed = z.object({
    content: z.string().trim().max(1000, 'Максимум 1000 символов').default(''),
  }).safeParse(req.body || {});

  if (!parsed.success) {
    await removeUploadedFiles(files);
    return res.status(400).json({
      success: false, message: parsed.error.issues[0]?.message || 'Некорректная публикация',
    });
  }
  if (!parsed.data.content && files.length === 0) {
    return res.status(400).json({ success: false, message: 'Добавь текст или прикрепи изображение' });
  }

  try {
    const post = await prisma.post.create({
      data: {
        content: parsed.data.content,
        authorId: req.user.id,
        images: files.length
          ? { create: files.map(file => ({ url: file.url })) }
          : undefined,
      },
      select: postSelect,
    });
    res.status(201).json({ success: true, post: { ...post, likedByMe: false } });
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
}

export async function deletePost(req, res, next) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, images: { select: { url: true } } },
    });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    if (post.authorId !== req.user.id) return res.status(403).json({
      success: false, message: 'Можно удалить только свою публикацию',
    });
    await prisma.post.delete({ where: { id: post.id } });
    await removePostImageFiles(post.images.map(image => image.url));
    res.json({ success: true });
  } catch (error) { next(error); }
}

export async function togglePostLike(req, res, next) {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    const where = { postId_userId: { postId: post.id, userId: req.user.id } };
    const existing = await prisma.postLike.findUnique({ where });
    if (existing) {
      await prisma.postLike.delete({ where });
      const count = await prisma.postLike.count({ where: { postId: post.id } });
      return res.json({ success: true, liked: false, count });
    }
    await prisma.postLike.create({ data: { postId: post.id, userId: req.user.id } });
    await createNotification({ type: 'LIKE', recipientId: post.authorId, actorId: req.user.id, postId: post.id });
    const count = await prisma.postLike.count({ where: { postId: post.id } });
    res.json({ success: true, liked: true, count });
  } catch (error) { next(error); }
}

export async function listPostComments(req, res, next) {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    const comments = await prisma.comment.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, content: true, authorId: true, createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    res.json({ success: true, comments });
  } catch (error) { next(error); }
}

export async function createPostComment(req, res, next) {
  const parsed = z.object({
    content: z.string().trim().min(1, 'Комментарий не может быть пустым').max(500, 'Максимум 500 символов'),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    success: false, message: parsed.error.issues[0]?.message || 'Некорректный комментарий',
  });
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    const comment = await prisma.comment.create({
      data: { postId: post.id, authorId: req.user.id, content: parsed.data.content },
      select: {
        id: true, content: true, authorId: true, createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    await createNotification({ type: 'COMMENT', recipientId: post.authorId, actorId: req.user.id, postId: post.id });
    res.status(201).json({ success: true, comment });
  } catch (error) { next(error); }
}

export async function deletePostComment(req, res, next) {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.commentId }, select: { id: true, authorId: true },
    });
    if (!comment) return res.status(404).json({ success: false, message: 'Комментарий не найден' });
    if (comment.authorId !== req.user.id) return res.status(403).json({
      success: false, message: 'Можно удалить только свой комментарий',
    });
    await prisma.comment.delete({ where: { id: comment.id } });
    res.json({ success: true });
  } catch (error) { next(error); }
}
