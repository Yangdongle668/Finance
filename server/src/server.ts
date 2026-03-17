import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { runMigrations } from './infrastructure/database/migrate'
import { logger } from './infrastructure/logger'
import { errorHandler, notFound } from './api/middleware/errorHandler'

import authRoutes from './api/routes/auth'
import voucherRoutes from './api/routes/vouchers'
import accountRoutes from './api/routes/accounts'
import reportRoutes from './api/routes/reports'
import periodRoutes from './api/routes/periods'
import assetRoutes from './api/routes/assets'
import invoiceRoutes from './api/routes/invoices'

const app = express()
const PORT = process.env.PORT || 3001

// ── Security ─────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
}))

// ── Middleware ────────────────────────────────────────────
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev', { stream: { write: msg => logger.info(msg.trim()) } }))

// ── Health check ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/vouchers', voucherRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/periods', periodRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/invoices', invoiceRoutes)

// ── Error handling ────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────
async function bootstrap() {
  try {
    runMigrations()
    app.listen(PORT, () => {
      logger.info(`🚀 精斗云云会计系统后端启动: http://localhost:${PORT}`)
    })
  } catch (err) {
    logger.error('启动失败', err)
    process.exit(1)
  }
}

bootstrap()
