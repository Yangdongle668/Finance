import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../../infrastructure/database/db'
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

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE username=? AND is_enabled=1').get(username) as {
    id: string; username: string; password: string; name: string; role: string
  } | undefined

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ code: 401, message: '用户名或密码错误' })
    return
  }

  db.prepare('UPDATE users SET last_login=? WHERE id=?').run(dayjs().toISOString(), user.id)

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  )

  ok(res, { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } })
})

router.get('/me', authenticate, (req: Request, res: Response) => {
  const db = getDb()
  const user = db.prepare('SELECT id,username,name,role,email,last_login FROM users WHERE id=?').get(req.user!.userId) as object
  ok(res, user)
})

router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body
  const db = getDb()
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
  const db = getDb()
  const users = db.prepare('SELECT id,username,name,role,email,is_enabled,last_login,created_at FROM users ORDER BY created_at').all()
  ok(res, users)
})

router.post('/users', authenticate, async (req: Request, res: Response) => {
  const { username, password, name, role, email } = req.body
  if (req.user!.role !== 'admin') { res.status(403).json({ code: 403, message: '权限不足' }); return }
  const db = getDb()
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username)
  if (exists) { res.status(400).json({ code: 400, message: '用户名已存在' }); return }
  const hashed = await bcrypt.hash(password || '123456', 10)
  const now = dayjs().toISOString()
  const id = uuid()
  db.prepare('INSERT INTO users (id,username,password,name,role,email,is_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)')
    .run(id, username, hashed, name, role || 'accountant', email || null, now, now)
  ok(res, { id }, '用户创建成功')
})

export default router
