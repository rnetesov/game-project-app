import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { createNotification } from '../utils/notifications.js';

const userSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  level: true,
};

const conversationInclude = {
  members: { include: { user: { select: userSelect } } },
  messages: {
    take: 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { sender: { select: userSelect } },
  },
};

async function getMembership(conversationId, userId) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, conversationId: true, userId: true, lastReadAt: true },
  });
}

async function shapeConversation(membership, userId) {
  const conversation = membership.conversation;
  const otherMember = conversation.members.find(member => member.userId !== userId);
  const unreadCount = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: userId },
      ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
    },
  });

  return {
    id: conversation.id,
    otherUser: otherMember?.user || null,
    lastMessage: conversation.messages[0] || null,
    unreadCount,
    updatedAt: conversation.updatedAt,
  };
}

export async function listConversations(req, res, next) {
  try {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: req.user.id },
      include: { conversation: { include: conversationInclude } },
      orderBy: { conversation: { updatedAt: 'desc' } },
      take: 100,
    });
    const conversations = await Promise.all(
      memberships.map(membership => shapeConversation(
        { ...membership, conversation: membership.conversation },
        req.user.id,
      )),
    );
    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
}

export async function openConversation(req, res, next) {
  const parsed = z.object({ userId: z.string().min(1).max(64) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Укажи пользователя для переписки' });
  }

  const otherUserId = parsed.data.userId;
  if (otherUserId === req.user.id) {
    return res.status(400).json({ success: false, message: 'Нельзя начать переписку с самим собой' });
  }

  try {
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Any registered user can receive a new direct message; friendship is not required.
    const directKey = [req.user.id, otherUserId].sort().join(':');
    let conversation = await prisma.conversation.findUnique({
      where: { directKey },
      select: { id: true },
    });

    if (!conversation) {
      const now = new Date();
      try {
        conversation = await prisma.conversation.create({
          data: {
            directKey,
            members: {
              create: [
                { userId: req.user.id, lastReadAt: now },
                { userId: otherUserId, lastReadAt: now },
              ],
            },
          },
          select: { id: true },
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        conversation = await prisma.conversation.findUnique({
          where: { directKey },
          select: { id: true },
        });
        if (!conversation) throw error;
      }
    }

    res.status(200).json({ success: true, conversation: { id: conversation.id } });
  } catch (error) {
    next(error);
  }
}

export async function listMessages(req, res, next) {
  const parsed = z.object({
    before: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Некорректные параметры истории сообщений' });
  }

  try {
    const membership = await getMembership(req.params.id, req.user.id);
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Диалог не найден' });
    }

    if (parsed.data.before) {
      const cursorExists = await prisma.message.findFirst({
        where: { id: parsed.data.before, conversationId: req.params.id },
        select: { id: true },
      });
      if (!cursorExists) {
        return res.status(400).json({ success: false, message: 'Некорректная позиция истории' });
      }
    }

    const rows = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      ...(parsed.data.before ? { cursor: { id: parsed.data.before }, skip: 1 } : {}),
      take: parsed.data.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        content: true,
        senderId: true,
        createdAt: true,
        sender: { select: userSelect },
      },
    });
    const hasMore = rows.length > parsed.data.limit;
    const page = hasMore ? rows.slice(0, parsed.data.limit) : rows;
    const messages = page.reverse();

    res.json({
      success: true,
      messages,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req, res, next) {
  const parsed = z.object({
    content: z.string().trim().min(1, 'Сообщение не может быть пустым').max(2000, 'Максимум 2000 символов'),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Некорректное сообщение',
    });
  }

  try {
    const membership = await getMembership(req.params.id, req.user.id);
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Диалог не найден' });
    }

    const recipient = await prisma.conversationMember.findFirst({
      where: { conversationId: req.params.id, userId: { not: req.user.id } },
      select: { userId: true },
    });
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Получатель диалога не найден' });
    }

    const now = new Date();
    const message = await prisma.$transaction(async tx => {
      const created = await tx.message.create({
        data: {
          conversationId: req.params.id,
          senderId: req.user.id,
          content: parsed.data.content,
          createdAt: now,
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          sender: { select: userSelect },
        },
      });
      await tx.conversation.update({
        where: { id: req.params.id },
        data: { updatedAt: now },
      });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId: req.params.id, userId: req.user.id } },
        data: { lastReadAt: now },
      });
      return created;
    });

    await createNotification({
      type: 'MESSAGE',
      recipientId: recipient.userId,
      actorId: req.user.id,
      conversationId: req.params.id,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
}

export async function markConversationRead(req, res, next) {
  try {
    const now = new Date();
    const result = await prisma.conversationMember.updateMany({
      where: { conversationId: req.params.id, userId: req.user.id },
      data: { lastReadAt: now },
    });
    if (!result.count) {
      return res.status(404).json({ success: false, message: 'Диалог не найден' });
    }
    // Reading the chat updates message unread state only.
    // Message notifications stay unread until the user opens them in the notification panel
    // or explicitly marks all notifications as read.
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
