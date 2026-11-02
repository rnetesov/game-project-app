import { z } from 'zod';
import { prisma } from '../config/prisma.js';

const STATUSES = ['PLAYING', 'WANT_TO_PLAY', 'COMPLETED'];
const gameSelect = {
  id: true,
  slug: true,
  title: true,
  genre: true,
  platforms: true,
  releaseYear: true,
  coverUrl: true,
};

export async function listGames(req, res, next) {
  const parsed = z.object({
    q: z.string().trim().max(100).default(''),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Некорректный поисковый запрос' });
  }

  try {
    const q = parsed.data.q;
    const games = await prisma.game.findMany({
      where: q ? {
        OR: [
          { title: { contains: q } },
          { genre: { contains: q } },
        ],
      } : undefined,
      orderBy: { title: 'asc' },
      take: 60,
      select: {
        ...gameSelect,
        userGames: {
          where: { userId: req.user.id },
          select: { status: true },
          take: 1,
        },
      },
    });

    res.json({
      success: true,
      games: games.map(({ userGames, ...game }) => ({
        ...game,
        libraryStatus: userGames[0]?.status || null,
      })),
    });
  } catch (error) { next(error); }
}

export async function getUserLibrary(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, username: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Игрок не найден' });

    const entries = await prisma.userGame.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        game: { select: gameSelect },
      },
    });

    const counts = entries.reduce((result, entry) => {
      result.total += 1;
      result[entry.status] = (result[entry.status] || 0) + 1;
      return result;
    }, { total: 0, PLAYING: 0, WANT_TO_PLAY: 0, COMPLETED: 0 });

    res.json({ success: true, user, entries, counts });
  } catch (error) { next(error); }
}

export async function setLibraryStatus(req, res, next) {
  const parsed = z.object({
    status: z.enum(STATUSES),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Выбери корректный статус игры' });
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      select: { id: true },
    });
    if (!game) return res.status(404).json({ success: false, message: 'Игра не найдена в каталоге' });

    const entry = await prisma.userGame.upsert({
      where: { userId_gameId: { userId: req.user.id, gameId: game.id } },
      create: { userId: req.user.id, gameId: game.id, status: parsed.data.status },
      update: { status: parsed.data.status },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        game: { select: gameSelect },
      },
    });
    res.json({ success: true, entry });
  } catch (error) { next(error); }
}

export async function removeFromLibrary(req, res, next) {
  try {
    const result = await prisma.userGame.deleteMany({
      where: { userId: req.user.id, gameId: req.params.gameId },
    });
    res.json({ success: true, removed: result.count > 0 });
  } catch (error) { next(error); }
}
