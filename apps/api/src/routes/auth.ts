import { Router } from 'express'
import { register, login,checkUsername,changePassword } from '../controllers/auth'
import { requireAuth } from '../middleware/auth'

export const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post("/check-username", checkUsername);
authRouter.post("/change-password", requireAuth, changePassword);