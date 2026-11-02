import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { removeGameCoverFile } from '../middleware/game-cover-upload.middleware.js';

const STATUSES = ['PLAYING', 'WANT_TO_PLAY', 'COMPLETED'];
const GENRES = ['RPG', 'Action', 'Shooter', 'Racing', 'Roguelike', 'Metroidvania', 'Simulator', 'Puzzle', 'Sandbox', 'Adventure', 'Horror'];
const gameSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  genre: true,
  subGenre: true,
  platforms: true,
  releaseYear: true,
  coverUrl: true,
  createdBy: { select: { username: true } },
};

export async function listGames(req, res, next) {
  const parsed = z.object({
    q: z.string().trim().max(100).default(''),
    genre: z.enum(GENRES).optional(),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Некорректные параметры каталога' });
  }

  try {
    const { q, genre } = parsed.data;
    const where = {
      ...(genre ? { genre } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q } },
          { genre: { contains: q } },
          { subGenre: { contains: q } },
        ],
      } : {}),
    };
    const games = await prisma.game.findMany({
      where,
      orderBy: [{ genre: 'asc' }, { title: 'asc' }],
      take: 200,
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

export async function getGameBySlug(req, res, next) {
  try {
    const game = await prisma.game.findUnique({
      where: { slug: req.params.slug },
      select: {
        ...gameSelect,
        userGames: {
          where: { userId: req.user.id },
          select: { status: true },
          take: 1,
        },
      },
    });
    if (!game) return res.status(404).json({ success: false, message: 'Игра не найдена в каталоге' });
    const { userGames, ...gameData } = game;
    return res.json({ success: true, game: { ...gameData, libraryStatus: userGames[0]?.status || null } });
  } catch (error) { next(error); }
}

function createGameSlug(title) {
  const slug = title
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
  return slug || 'game-' + Date.now();
}

export async function addGameToCatalog(req, res, next) {
  const coverFile = req.file || null;
  const parsed = z.object({
    title: z.string().trim().min(2, 'Название должно содержать минимум 2 символа').max(80),
    description: z.string().trim().min(10, 'Добавь короткое описание игры').max(400, 'Описание должно быть не длиннее 400 символов'),
    genre: z.enum(GENRES),
    subGenre: z.string().trim().max(40).optional().default(''),
    platforms: z.string().trim().min(2, 'Укажи хотя бы одну платформу').max(120),
    releaseYear: z.preprocess(
      value => value === '' || value == null ? null : Number(value),
      z.number().int().min(1970).max(new Date().getFullYear() + 2).nullable()
    ),
  }).strict().safeParse(req.body || {});

  if (!parsed.success) {
    await removeGameCoverFile(coverFile);
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Проверь данные игры',
    });
  }

  try {
    const slug = createGameSlug(parsed.data.title);
    const duplicate = await prisma.game.findFirst({
      where: { OR: [{ slug }, { title: parsed.data.title }] },
      select: { id: true, title: true },
    });
    if (duplicate) {
      await removeGameCoverFile(coverFile);
      return res.status(409).json({
        success: false,
        message: 'Такая игра уже есть в общем каталоге: ' + duplicate.title,
      });
    }

    const recentSubmissions = await prisma.game.count({
      where: {
        createdById: req.user.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentSubmissions >= 10) {
      await removeGameCoverFile(coverFile);
      return res.status(429).json({
        success: false,
        message: 'Можно добавлять не более 10 игр в каталог за 24 часа',
      });
    }

    const game = await prisma.game.create({
      data: {
        slug,
        title: parsed.data.title,
        description: parsed.data.description,
        genre: parsed.data.genre,
        subGenre: parsed.data.subGenre || null,
        platforms: parsed.data.platforms,
        releaseYear: parsed.data.releaseYear,
        coverUrl: coverFile?.url || null,
        createdById: req.user.id,
      },
      select: gameSelect,
    });
    res.status(201).json({ success: true, game: { ...game, libraryStatus: null } });
  } catch (error) {
    await removeGameCoverFile(coverFile);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Похоже, такая игра уже есть в каталоге' });
    }
    next(error);
  }
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
