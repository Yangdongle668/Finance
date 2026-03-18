import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { getMasterDb, initCompanyDb } from './infrastructure/database/db'
import { logger } from './infrastructure/logger'
import { errorHandler, notFound } from './api/middleware/errorHandler'
import { companyScope } from './api/middleware/auth'

import authRoutes from './api/routes/auth'
import companyRoutes from './api/routes/companies'
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

// ── Routes (no company scope needed) ─────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/companies', companyRoutes)

// ── Routes (company-scoped) ──────────────────────────────
app.use('/api/vouchers', companyScope, voucherRoutes)
app.use('/api/accounts', companyScope, accountRoutes)
app.use('/api/reports', companyScope, reportRoutes)
app.use('/api/periods', companyScope, periodRoutes)
app.use('/api/assets', companyScope, assetRoutes)
app.use('/api/invoices', companyScope, invoiceRoutes)

// ── Error handling ────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Initialize master database
    const masterDb = getMasterDb()

    // Ensure all existing company databases have the latest schema
    const companies = masterDb.prepare('SELECT id FROM companies').all() as { id: string }[]
    for (const c of companies) {
      initCompanyDb(c.id)
    }

    // Seed admin user if none exists
    const adminExists = masterDb.prepare('SELECT id FROM users LIMIT 1').get()
    if (!adminExists) {
      const bcrypt = require('bcryptjs')
      const { v4: uuid } = require('uuid')
      const now = new Date().toISOString()
      const pwd = bcrypt.hashSync('Admin@123', 10)
      masterDb.prepare(
        'INSERT INTO users (id,username,password,name,role,is_enabled,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)'
      ).run(uuid(), 'admin', pwd, '系统管理员', 'admin', now, now)
      logger.info('Default admin user created: admin / Admin@123')
    }

    app.listen(PORT, () => {
      logger.info(`🚀 乐算云会计系统后端启动: http://localhost:${PORT}`)
    })
  } catch (err) {
    logger.error('启动失败', err)
    process.exit(1)
  }
}

bootstrap()
