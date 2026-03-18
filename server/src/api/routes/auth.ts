import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getMasterDb } from '../../infrastructure/database/db'
import { ok } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import dayjs from 'dayjs'
import { v4 as uuid } from 'uuid'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ code: 400, message: '用户名和密码不能为空' })
    return
  }

  const db = getMasterDb()
  const user = db.prepare('SELECT * FROM users WHERE username=? AND is_enabled=1').get(username) as {
    id: string; username: string; password: string; name: string; email: string; phone: string; avatar: string
  } | undefined

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ code: 401, message: '用户名或密码错误' })
    return
  }

  db.prepare('UPDATE users SET last_login=? WHERE id=?').run(dayjs().toISOString(), user.id)

  // Get user's companies and roles
  const companies = db.prepare(`
    SELECT uc.role, uc.permissions, c.id as company_id, c.name as company_name, c.status
    FROM user_companies uc JOIN companies c ON uc.company_id = c.id
    WHERE uc.user_id = ? AND c.status = 'active'
    ORDER BY c.name
  `).all(user.id) as { role: string; permissions: string | null; company_id: string; company_name: string }[]

  // Determine default role (from first company or 'user')
  const defaultRole = companies.length > 0 ? companies[0].role : 'viewer'

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: defaultRole },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  )

  ok(res, {
    token,
    user: { id: user.id, username: user.username, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar },
    companies: companies.map(c => ({ id: c.company_id, name: c.company_name, role: c.role, permissions: c.permissions ? JSON.parse(c.permissions) : null }))
  })
})

router.get('/me', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const user = db.prepare('SELECT id,username,name,email,phone,avatar,last_login FROM users WHERE id=?').get(req.user!.userId) as object | undefined
  if (!user) { res.status(404).json({ code: 404, message: '用户不存在' }); return }

  const companies = db.prepare(`
    SELECT uc.role, uc.permissions, c.id as company_id, c.name as company_name
    FROM user_companies uc JOIN companies c ON uc.company_id = c.id
    WHERE uc.user_id = ? AND c.status = 'active'
    ORDER BY c.name
  `).all(req.user!.userId) as { role: string; permissions: string | null; company_id: string; company_name: string }[]

  ok(res, {
    ...user,
    companies: companies.map(c => ({ id: c.company_id, name: c.company_name, role: c.role, permissions: c.permissions ? JSON.parse(c.permissions) : null }))
  })
})

// ── Update profile ────────────────────────────────────────
router.put('/profile', authenticate, (req: Request, res: Response) => {
  const { name, email, phone, avatar } = req.body
  const db = getMasterDb()
  const now = dayjs().toISOString()
  db.prepare('UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone), avatar=COALESCE(?,avatar), updated_at=? WHERE id=?')
    .run(name || null, email || null, phone || null, avatar || null, now, req.user!.userId)
  const updated = db.prepare('SELECT id,username,name,email,phone,avatar FROM users WHERE id=?').get(req.user!.userId)
  ok(res, updated, '个人信息更新成功')
})

router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body
  const db = getMasterDb()
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user!.userId) as { password: string } | undefined
  if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
    res.status(400).json({ code: 400, message: '原密码错误' })
    return
  }
  const hashed = await bcrypt.hash(newPassword, 10)
  db.prepare('UPDATE users SET password=?,updated_at=? WHERE id=?').run(hashed, dayjs().toISOString(), req.user!.userId)
  ok(res, null, '密码修改成功')
})

// ── 用户管理（管理员） ────────────────────────────────────

router.get('/users', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const users = db.prepare('SELECT id,username,name,email,phone,is_enabled,last_login,created_at FROM users ORDER BY created_at').all()
  ok(res, users)
})

router.post('/users', authenticate, async (req: Request, res: Response) => {
  const { username, password, name, email, phone } = req.body
  // Check if user is admin in any company
  const db = getMasterDb()
  const isAdmin = db.prepare("SELECT 1 FROM user_companies WHERE user_id=? AND role='admin' LIMIT 1").get(req.user!.userId)
  if (!isAdmin) { res.status(403).json({ code: 403, message: '权限不足' }); return }

  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username)
  if (exists) { res.status(400).json({ code: 400, message: '用户名已存在' }); return }
  const hashed = await bcrypt.hash(password || '123456', 10)
  const now = dayjs().toISOString()
  const id = uuid()
  db.prepare('INSERT INTO users (id,username,password,name,email,phone,is_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)')
    .run(id, username, hashed, name, email || null, phone || null, now, now)
  ok(res, { id }, '用户创建成功')
})

// Toggle user enabled status
router.put('/users/:id/toggle', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const isAdmin = db.prepare("SELECT 1 FROM user_companies WHERE user_id=? AND role='admin' LIMIT 1").get(req.user!.userId)
  if (!isAdmin) { res.status(403).json({ code: 403, message: '权限不足' }); return }

  const target = db.prepare('SELECT is_enabled FROM users WHERE id=?').get(req.params.id) as { is_enabled: number } | undefined
  if (!target) { res.status(404).json({ code: 404, message: '用户不存在' }); return }
  db.prepare('UPDATE users SET is_enabled=?, updated_at=? WHERE id=?').run(target.is_enabled ? 0 : 1, dayjs().toISOString(), req.params.id)
  ok(res, null, target.is_enabled ? '已禁用' : '已启用')
})

export default router
