import { z } from 'zod';
import { prisma } from '../config/prisma.js';

export async function listNotifications(req, res, next) {
  const parsed = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(30),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Некорректные параметры уведомлений' });
  }

  try {
    const where = { recipientId: req.user.id };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        take: parsed.data.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          type: true,
          postId: true,
          conversationId: true,
          createdAt: true,
          readAt: true,
          actor: { select: { id: true, username: true, avatarUrl: true } },
          post: { select: { id: true } },
        },
      }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, recipientId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, updated: result.count });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await prisma.notification.updateMany({
      where: { recipientId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, updated: result.count });
  } catch (error) {
    next(error);
  }
}
