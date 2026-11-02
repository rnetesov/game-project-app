import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parseGameCoverMultipart } from '../middleware/game-cover-upload.middleware.js';
import {
  listGames,
  addGameToCatalog,
  getUserLibrary,
  setLibraryStatus,
  removeFromLibrary,
} from '../controllers/games.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listGames);
router.post('/', parseGameCoverMultipart, addGameToCatalog);
router.get('/library/:username', getUserLibrary);
router.put('/:gameId/library', setLibraryStatus);
router.delete('/:gameId/library', removeFromLibrary);

export default router;
