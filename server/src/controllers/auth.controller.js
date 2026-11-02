import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { createAccessToken } from '../utils/token.js';

const registerSchema = z.object({
  username: z.string().trim().min(3, 'Никнейм должен содержать минимум 3 символа').max(24).regex(/^[a-zA-Z0-9_]+$/, 'Используй латинские буквы, цифры и _'),
  email: z.string().trim().email('Укажи корректный email').max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов').max(72),
});

const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'Укажи email или никнейм'),
  password: z.string().min(1, 'Укажи пароль').max(72),
});

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  level: user.level,
  xp: user.xp,
  createdAt: user.createdAt,
});

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Проверь введённые данные',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { username, email, password } = parsed.data;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: { equals: username } }] },
    select: { email: true, username: true },
  });

  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    return res.status(409).json({
      success: false,
      message: field === 'email' ? 'Этот email уже зарегистрирован' : 'Этот никнейм уже занят',
      field,
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash },
    select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true },
  });

  return res.status(201).json({
    success: true,
    message: 'Аккаунт успешно создан',
    token: createAccessToken(user.id),
    user: publicUser(user),
  });
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Проверь данные' });
  }

  const { emailOrUsername, password } = parsed.data;
  const value = emailOrUsername.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: value.toLowerCase() },
        { username: { equals: value } },
      ],
    },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'Неверный email, никнейм или пароль' });
  }

  return res.json({
    success: true,
    message: 'Вход выполнен успешно',
    token: createAccessToken(user.id),
    user: publicUser(user),
  });
}

export function getCurrentUser(req, res) {
  return res.json({ success: true, user: req.user });
}
