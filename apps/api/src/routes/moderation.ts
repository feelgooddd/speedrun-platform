
import { Router } from 'express'
import { getModQueue, verifyRun,getGlobalModQueue} from '../controllers/moderation'
import { requireAuth } from '../middleware/auth'
import { isGameModerator } from '../middleware/checkRole'
import { isAdmin } from "../middleware/checkRole";


export const moderationRouter = Router()

moderationRouter.get("/queue", requireAuth, isAdmin, getGlobalModQueue);

moderationRouter.get('/:gameSlug/mod-queue', requireAuth, isGameModerator, getModQueue)
moderationRouter.patch('/runs/:id/verify', requireAuth, isGameModerator, verifyRun)