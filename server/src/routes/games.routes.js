import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listGames,
  getUserLibrary,
  setLibraryStatus,
  removeFromLibrary,
} from '../controllers/games.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', listGames);
router.get('/library/:username', getUserLibrary);
router.put('/:gameId/library', setLibraryStatus);
router.delete('/:gameId/library', removeFromLibrary);

export default router;
