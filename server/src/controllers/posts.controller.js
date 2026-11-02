import { z } from 'zod';
import { prisma } from '../config/prisma.js';

const postSelect = {
  id: true,
  content: true,
  authorId: true,
  createdAt: true,
  author: { select: { id: true, username: true, avatarUrl: true } },
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
      select: postSelect,
    });
    const hasMore = rows.length > limit;
    const posts = hasMore ? rows.slice(0, limit) : rows;
    res.json({ success: true, posts, nextCursor: hasMore ? posts[posts.length - 1].id : null });
  } catch (error) { next(error); }
}

export async function createPost(req, res, next) {
  const parsed = z.object({
    content: z.string().trim().min(1, 'Напиши текст публикации').max(1000, 'Максимум 1000 символов'),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    success: false, message: parsed.error.issues[0]?.message || 'Некорректная публикация',
  });
  try {
    const post = await prisma.post.create({
      data: { content: parsed.data.content, authorId: req.user.id },
      select: postSelect,
    });
    res.status(201).json({ success: true, post });
  } catch (error) { next(error); }
}

export async function deletePost(req, res, next) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id }, select: { id: true, authorId: true },
    });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    if (post.authorId !== req.user.id) return res.status(403).json({
      success: false, message: 'Можно удалить только свою публикацию',
    });
    await prisma.post.delete({ where: { id: post.id } });
    res.json({ success: true });
  } catch (error) { next(error); }
}
