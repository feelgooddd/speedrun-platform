import { Router } from 'express'
import { gamesRouter } from './games'
import { runsRouter } from './runs'
import { moderationRouter } from './moderation'
import { usersRouter } from './users'
import { authRouter } from './auth'

export const router = Router()

router.use('/games', gamesRouter)
router.use('/runs', runsRouter)
router.use('/moderation', moderationRouter)
router.use('/users', usersRouter)
router.use('/auth', authRouter)