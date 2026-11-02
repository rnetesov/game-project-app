import { prisma } from '../config/prisma.js';

export async function createNotification({ type, recipientId, actorId, postId, commentId, conversationId }) {
  if (!recipientId || !actorId || recipientId === actorId) return;

  try {
    await prisma.notification.create({
      data: {
        type,
        recipientId,
        actorId,
        ...(postId ? { postId } : {}),
        ...(commentId ? { commentId } : {}),
        ...(conversationId ? { conversationId } : {}),
      },
    });
  } catch (error) {
    // A notification must never turn a successful comment/like/friend action into a failed request.
    console.error('[notifications] Failed to create notification:', error);
  }
}
