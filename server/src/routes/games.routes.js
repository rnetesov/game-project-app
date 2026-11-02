import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parseGameCoverMultipart } from '../middleware/game-cover-upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  listGames,
  getGameBySlug,
  addGameToCatalog,
  getUserLibrary,
  setLibraryStatus,
  removeFromLibrary,
} from '../controllers/games.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listGames));
router.get('/by-slug/:slug', asyncHandler(getGameBySlug));
router.post('/', parseGameCoverMultipart, asyncHandler(addGameToCatalog));
router.get('/library/:username', asyncHandler(getUserLibrary));
router.put('/:gameId/library', asyncHandler(setLibraryStatus));
router.delete('/:gameId/library', asyncHandler(removeFromLibrary));

export default router;
