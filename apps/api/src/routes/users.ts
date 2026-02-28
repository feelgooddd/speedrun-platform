import { Router } from 'express'
import { getUserProfile, getUserRuns, getMe, updateMe, searchUsers, updateUserRole, assignGameModerator, removeGameModerator} from '../controllers/users'
import { requireAuth } from '../middleware/auth';
import { isAdmin } from '../middleware/checkRole';
import { getMyModeratedGames } from '../controllers/users';

export const usersRouter = Router()

usersRouter.get('/me/moderated-games', requireAuth, getMyModeratedGames);
usersRouter.get('/me', requireAuth, getMe);
usersRouter.patch('/me', requireAuth, updateMe);
usersRouter.get('/search', requireAuth, isAdmin, searchUsers);
usersRouter.patch('/:id/role', requireAuth, isAdmin, updateUserRole);
usersRouter.post('/:id/moderate/:gameSlug', requireAuth, isAdmin, assignGameModerator);
usersRouter.delete('/:id/moderate/:gameSlug', requireAuth, isAdmin, removeGameModerator);
usersRouter.get('/:id', getUserProfile);
usersRouter.get('/:id/runs', getUserRuns);