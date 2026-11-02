import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { createNotification } from '../utils/notifications.js';

const userSelect = { id: true, username: true, avatarUrl: true, bio: true, level: true, lastSeenAt: true };
const onlineSince = () => new Date(Date.now() - 90 * 1000);
const shapeUser = (u) => ({ ...u, online: Boolean(u.lastSeenAt && u.lastSeenAt >= onlineSince()) });

export async function searchUsers(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ success: true, users: [] });
  const users = await prisma.user.findMany({
    where: { id: { not: req.user.id }, username: { contains: q } },
    select: userSelect, take: 20, orderBy: { username: 'asc' },
  });
  const ids = users.map(u => u.id);
  const relations = await prisma.friendRequest.findMany({
    where: { OR: [{ senderId: req.user.id, receiverId: { in: ids } }, { receiverId: req.user.id, senderId: { in: ids } }] },
    select: { id: true, senderId: true, receiverId: true, status: true },
  });
  const usersWithRelation = users.map(u => {
    const relation = relations.find(r => (r.senderId === req.user.id && r.receiverId === u.id) || (r.receiverId === req.user.id && r.senderId === u.id));
    let relationship = 'NONE';
    if (relation?.status === 'ACCEPTED') relationship = 'FRIENDS';
    else if (relation?.status === 'PENDING') relationship = relation.senderId === req.user.id ? 'SENT' : 'RECEIVED';
    return { ...shapeUser(u), relationship, requestId: relation?.status === 'PENDING' ? relation.id : null };
  });
  res.json({ success: true, users: usersWithRelation });
}

export async function getRelationship(req, res) {
  const targetId = req.params.userId;
  if (targetId === req.user.id) return res.json({ success: true, relationship: 'SELF', requestId: null });
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return res.status(404).json({ success: false, message: 'Игрок не найден' });
  const relation = await prisma.friendRequest.findFirst({
    where: { OR: [
      { senderId: req.user.id, receiverId: targetId },
      { senderId: targetId, receiverId: req.user.id },
    ] },
    select: { id: true, senderId: true, receiverId: true, status: true },
  });
  let relationship = 'NONE';
  if (relation?.status === 'ACCEPTED') relationship = 'FRIENDS';
  else if (relation?.status === 'PENDING') relationship = relation.senderId === req.user.id ? 'SENT' : 'RECEIVED';
  res.json({ success: true, relationship, requestId: relation?.status === 'PENDING' ? relation.id : null });
}

export async function listSentRequests(req, res) {
  const requests = await prisma.friendRequest.findMany({
    where: { senderId: req.user.id, status: 'PENDING' },
    include: { receiver: { select: userSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, requests: requests.map(r => ({ id: r.id, createdAt: r.createdAt, user: shapeUser(r.receiver) })) });
}

export async function cancelRequest(req, res) {
  const request = await prisma.friendRequest.findFirst({
    where: { id: req.params.id, senderId: req.user.id, status: 'PENDING' },
    select: { id: true },
  });
  if (!request) return res.status(404).json({ success: false, message: 'Исходящая заявка не найдена' });
  await prisma.friendRequest.delete({ where: { id: request.id } });
  res.json({ success: true, message: 'Заявка отменена' });
}

export async function listFriends(req, res) {
  const rows = await prisma.friendRequest.findMany({
    where: { status: 'ACCEPTED', OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
    include: {
      sender: { select: userSelect },
      receiver: { select: userSelect },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const friends = rows.map(r => shapeUser(r.senderId === req.user.id ? r.receiver : r.sender));
  res.json({ success: true, friends });
}

export async function listRequests(req, res) {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: req.user.id, status: 'PENDING' },
    include: { sender: { select: userSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, requests: requests.map(r => ({ id: r.id, createdAt: r.createdAt, user: shapeUser(r.sender) })) });
}

export async function sendRequest(req, res) {
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Укажи пользователя' });
  const { userId } = parsed.data;
  if (userId === req.user.id) return res.status(400).json({ success: false, message: 'Нельзя добавить самого себя' });
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return res.status(404).json({ success: false, message: 'Игрок не найден' });

  const existing = await prisma.friendRequest.findFirst({
    where: { OR: [{ senderId: req.user.id, receiverId: userId }, { senderId: userId, receiverId: req.user.id }] },
  });
  if (existing?.status === 'ACCEPTED') return res.status(409).json({ success: false, message: 'Вы уже друзья' });
  if (existing?.status === 'PENDING') {
    if (existing.receiverId === req.user.id) {
      const accepted = await prisma.friendRequest.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } });
      await createNotification({ type: 'FRIEND_ACCEPTED', recipientId: existing.senderId, actorId: req.user.id });
      return res.json({ success: true, message: 'Заявка принята', request: accepted });
    }
    return res.status(409).json({ success: false, message: 'Заявка уже отправлена' });
  }
  const request = await prisma.friendRequest.create({ data: { senderId: req.user.id, receiverId: userId } });
  await createNotification({ type: 'FRIEND_REQUEST', recipientId: userId, actorId: req.user.id });
  res.status(201).json({ success: true, message: 'Заявка отправлена', request });
}

export async function respondRequest(req, res) {
  const parsed = z.object({ action: z.enum(['accept', 'decline']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Неизвестное действие' });
  const request = await prisma.friendRequest.findFirst({ where: { id: req.params.id, receiverId: req.user.id, status: 'PENDING' } });
  if (!request) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
  if (parsed.data.action === 'accept') {
    await prisma.friendRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } });
    await createNotification({ type: 'FRIEND_ACCEPTED', recipientId: request.senderId, actorId: req.user.id });
    return res.json({ success: true, message: 'Теперь вы друзья' });
  }
  await prisma.friendRequest.delete({ where: { id: request.id } });
  res.json({ success: true, message: 'Заявка отклонена' });
}

export async function removeFriend(req, res) {
  const row = await prisma.friendRequest.findFirst({
    where: { status: 'ACCEPTED', OR: [
      { senderId: req.user.id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user.id },
    ] },
  });
  if (!row) return res.status(404).json({ success: false, message: 'Друг не найден' });
  await prisma.friendRequest.delete({ where: { id: row.id } });
  res.json({ success: true, message: 'Пользователь удалён из друзей' });
}

export async function heartbeat(req, res) {
  await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenAt: new Date() } });
  res.json({ success: true });
}
