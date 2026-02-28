import express from 'express'
import cors from 'cors'
import { router } from './routes'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}))

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', router)

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`)
})