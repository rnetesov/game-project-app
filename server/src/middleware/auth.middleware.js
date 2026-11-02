import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

export async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Требуется авторизация' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, username: true, email: true, avatarUrl: true,
        bio: true, level: true, xp: true, lastSeenAt: true, createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Недействительный или просроченный токен' });
  }
}
