import { z } from 'zod';
import { prisma } from '../config/prisma.js';

const updateSchema = z.object({
  username: z.string().trim().min(3, 'Никнейм должен содержать минимум 3 символа').max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Используй латинские буквы, цифры, _ или -').optional(),
  bio: z.string().trim().max(160, 'Описание — максимум 160 символов').optional(),
  avatarUrl: z.string().trim().url('Укажи корректный URL аватара').max(500).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, 'Нет данных для обновления');

const profileSelect = {
  id: true, username: true, avatarUrl: true, bio: true,
  level: true, xp: true, createdAt: true,
};

export async function getProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: profileSelect,
  });
  if (!user) return res.status(404).json({ success: false, message: 'Профиль не найден' });
  return res.json({ success: true, user });
}

export async function updateProfile(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Проверь данные',
    });
  }

  if (parsed.data.username) {
    const existing = await prisma.user.findFirst({
      where: { username: parsed.data.username, NOT: { id: req.user.id } },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ success: false, message: 'Этот никнейм уже занят' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: parsed.data,
      select: { ...profileSelect, email: true },
    });
    return res.json({ success: true, user });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Этот никнейм уже занят' });
    }
    throw error;
  }
}
