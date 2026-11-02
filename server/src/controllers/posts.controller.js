import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { createNotification } from '../utils/notifications.js';
import {
  removePostImageFiles,
  removeUploadedFiles,
} from '../middleware/post-upload.middleware.js';

const RICH_CONTENT_PREFIX = 'GAMEHUB_RICH_V1:';
const MAX_POST_TEXT_LENGTH = 1000;

function getPostTextLength(content) {
  if (!content.startsWith(RICH_CONTENT_PREFIX)) return content.length;

  let document;
  try {
    document = JSON.parse(content.slice(RICH_CONTENT_PREFIX.length));
  } catch {
    throw new Error('Некорректный формат форматированного текста');
  }
  if (document?.format !== 1 || !Array.isArray(document.blocks) || document.blocks.length > 500) {
    throw new Error('Некорректная структура форматированного текста');
  }

  let visitedNodes = 0;
  const countInline = (nodes, depth = 0) => {
    if (!Array.isArray(nodes) || depth > 20) throw new Error('Слишком сложное форматирование');
    return nodes.reduce((total, node) => {
      visitedNodes += 1;
      if (visitedNodes > 3000 || !node || typeof node !== 'object') {
        throw new Error('Слишком сложное форматирование');
      }
      if (node.type === 'text' && typeof node.text === 'string') return total + node.text.length;
      if (node.type === 'break') return total + 1;
      throw new Error('Некорректный элемент форматированного текста');
    }, 0);
  };

  return document.blocks.reduce((total, block) => {
    visitedNodes += 1;
    if (visitedNodes > 3000 || !block || typeof block !== 'object') {
      throw new Error('Слишком сложное форматирование');
    }
    if (block.type === 'paragraph' || block.type === 'heading') {
      return total + countInline(block.children);
    }
    if (block.type === 'list' && Array.isArray(block.items) && block.items.length <= 500) {
      return total + block.items.reduce((sum, item) => sum + countInline(item) + 1, 0);
    }
    throw new Error('Некорректный блок форматированного текста');
  }, 0);
}

const postSelect = {
  id: true,
  content: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, username: true, avatarUrl: true } },
  images: { select: { id: true, url: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
  reactions: { select: { type: true, userId: true, user: { select: { id: true, username: true, avatarUrl: true } } } },
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
      select: postSelect,
    });
    const hasMore = rows.length > limit;
    const posts = (hasMore ? rows.slice(0, limit) : rows).map(post => ({
      ...post,
      myReaction: post.reactions.find(reaction => reaction.userId === req.user.id)?.type || null,
      reactionCounts: post.reactions.reduce((counts, reaction) => {
        counts[reaction.type] = (counts[reaction.type] || 0) + 1;
        return counts;
      }, {}),
    }));
    res.json({ success: true, posts, nextCursor: hasMore ? posts[posts.length - 1].id : null });
  } catch (error) { next(error); }
}

export async function createPost(req, res, next) {
  const files = req.files || [];
  const parsed = z.object({
    content: z.string().trim().max(100000, 'Слишком большой текст публикации').default(''),
  }).safeParse(req.body || {});

  if (!parsed.success) {
    await removeUploadedFiles(files);
    return res.status(400).json({
      success: false, message: parsed.error.issues[0]?.message || 'Некорректная публикация',
    });
  }
  let textLength;
  try {
    textLength = getPostTextLength(parsed.data.content);
  } catch (error) {
    await removeUploadedFiles(files);
    return res.status(400).json({ success: false, message: error.message });
  }
  if (textLength > MAX_POST_TEXT_LENGTH) {
    await removeUploadedFiles(files);
    return res.status(400).json({ success: false, message: 'Максимум 1000 символов в публикации' });
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

export async function updatePost(req, res, next) {
  const files = req.files || [];
  const parsed = z.object({
    content: z.string().trim().max(100000, 'Слишком большой текст публикации').default(''),
    keepImageIds: z.string().optional().default('[]'),
  }).safeParse(req.body || {});

  if (!parsed.success) {
    await removeUploadedFiles(files);
    return res.status(400).json({
      success: false, message: parsed.error.issues[0]?.message || 'Некорректная публикация',
    });
  }

  let textLength;
  let keepImageIds;
  try {
    textLength = getPostTextLength(parsed.data.content);
    keepImageIds = JSON.parse(parsed.data.keepImageIds);
    if (!Array.isArray(keepImageIds) || keepImageIds.length > 4
      || keepImageIds.some(id => typeof id !== 'string' || id.length > 100)) {
      throw new Error('Некорректный список изображений');
    }
  } catch (error) {
    await removeUploadedFiles(files);
    return res.status(400).json({ success: false, message: error.message || 'Некорректные данные публикации' });
  }

  if (textLength > MAX_POST_TEXT_LENGTH) {
    await removeUploadedFiles(files);
    return res.status(400).json({ success: false, message: 'Максимум 1000 символов в публикации' });
  }
  if (keepImageIds.length + files.length > 4) {
    await removeUploadedFiles(files);
    return res.status(400).json({ success: false, message: 'Можно прикрепить не более 4 изображений' });
  }
  if (!parsed.data.content && keepImageIds.length + files.length === 0) {
    await removeUploadedFiles(files);
    return res.status(400).json({ success: false, message: 'Добавь текст или прикрепи изображение' });
  }

  try {
    const existingPost = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, images: { select: { id: true, url: true } } },
    });
    if (!existingPost) {
      await removeUploadedFiles(files);
      return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    }
    if (existingPost.authorId !== req.user.id) {
      await removeUploadedFiles(files);
      return res.status(403).json({ success: false, message: 'Можно редактировать только свою публикацию' });
    }

    const existingIds = new Set(existingPost.images.map(image => image.id));
    if (keepImageIds.some(id => !existingIds.has(id))) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, message: 'Список изображений публикации изменился. Обнови страницу и попробуй ещё раз.' });
    }

    const removedImages = existingPost.images.filter(image => !keepImageIds.includes(image.id));
    const post = await prisma.$transaction(async tx => {
      await tx.postImage.deleteMany({
        where: { postId: existingPost.id, id: { notIn: keepImageIds } },
      });
      return tx.post.update({
        where: { id: existingPost.id },
        data: {
          content: parsed.data.content,
          images: files.length ? { create: files.map(file => ({ url: file.url })) } : undefined,
        },
        select: postSelect,
      });
    });

    await removePostImageFiles(removedImages.map(image => image.url));
    res.json({ success: true, post });
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

export async function togglePostReaction(req, res, next) {
  const parsed = z.object({ type: z.enum(['FIRE', 'HEART', 'LAUGH', 'WOW', 'SAD']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Неизвестный тип реакции' });
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    const where = { postId_userId: { postId: post.id, userId: req.user.id } };
    const existing = await prisma.postReaction.findUnique({ where });
    let myReaction = parsed.data.type;
    if (existing?.type === parsed.data.type) {
      await prisma.postReaction.delete({ where });
      myReaction = null;
    } else {
      await prisma.postReaction.upsert({
        where,
        create: { postId: post.id, userId: req.user.id, type: parsed.data.type },
        update: { type: parsed.data.type },
      });
    }
    const reactions = await prisma.postReaction.findMany({ where: { postId: post.id }, select: { type: true } });
    const reactionCounts = reactions.reduce((counts, reaction) => {
      counts[reaction.type] = (counts[reaction.type] || 0) + 1;
      return counts;
    }, {});
    res.json({ success: true, myReaction, reactionCounts });
  } catch (error) { next(error); }
}

export async function listPostReactions(req, res, next) {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Публикация не найдена' });
    const reactions = await prisma.postReaction.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: 'desc' },
      select: { type: true, createdAt: true, user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.json({ success: true, reactions });
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
