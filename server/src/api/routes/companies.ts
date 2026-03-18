import { Router, Request, Response } from 'express'
import { getMasterDb } from '../../infrastructure/database/db'
import { runCompanyMigrations } from '../../infrastructure/database/migrate'
import { ok } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import dayjs from 'dayjs'
import { v4 as uuid } from 'uuid'

const router = Router()

// List companies the current user has access to
router.get('/', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const companies = db.prepare(`
    SELECT c.*, uc.role FROM companies c
    JOIN user_companies uc ON uc.company_id = c.id
    WHERE uc.user_id = ? ORDER BY c.name
  `).all(req.user!.userId)
  ok(res, companies)
})

// Get single company detail
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const company = db.prepare(`
    SELECT c.*, uc.role FROM companies c
    JOIN user_companies uc ON uc.company_id = c.id
    WHERE c.id = ? AND uc.user_id = ?
  `).get(req.params.id, req.user!.userId)
  if (!company) { res.status(404).json({ code: 404, message: '账套不存在或无权访问' }); return }
  ok(res, company)
})

// Create a new company (account set)
router.post('/', authenticate, (req: Request, res: Response) => {
  const { name, tax_no, legal_person, industry, address, phone, fiscal_year_start, accounting_standard, currency } = req.body
  if (!name) { res.status(400).json({ code: 400, message: '公司名称不能为空' }); return }

  const db = getMasterDb()
  const now = dayjs().toISOString()
  const id = uuid()

  db.prepare(`
    INSERT INTO companies (id,name,tax_no,legal_person,industry,address,phone,fiscal_year_start,accounting_standard,currency,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, name, tax_no || null, legal_person || null, industry || null, address || null, phone || null,
    fiscal_year_start || 1, accounting_standard || 'small', currency || 'CNY', 'active', now, now)

  // Link creating user as admin
  db.prepare('INSERT INTO user_companies (id,user_id,company_id,role,created_at) VALUES (?,?,?,?,?)')
    .run(uuid(), req.user!.userId, id, 'admin', now)

  // Initialize company database
  runCompanyMigrations(id)

  ok(res, { id }, '账套创建成功')
})

// Update company info
router.put('/:id', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  // Check admin role
  const uc = db.prepare("SELECT role FROM user_companies WHERE user_id=? AND company_id=?").get(req.user!.userId, req.params.id) as { role: string } | undefined
  if (!uc || uc.role !== 'admin') { res.status(403).json({ code: 403, message: '仅管理员可修改账套信息' }); return }

  const { name, tax_no, legal_person, industry, address, phone, fiscal_year_start, accounting_standard, currency } = req.body
  const now = dayjs().toISOString()
  db.prepare(`
    UPDATE companies SET name=COALESCE(?,name), tax_no=COALESCE(?,tax_no), legal_person=COALESCE(?,legal_person),
    industry=COALESCE(?,industry), address=COALESCE(?,address), phone=COALESCE(?,phone),
    fiscal_year_start=COALESCE(?,fiscal_year_start), accounting_standard=COALESCE(?,accounting_standard),
    currency=COALESCE(?,currency), updated_at=? WHERE id=?
  `).run(name || null, tax_no || null, legal_person || null, industry || null, address || null, phone || null,
    fiscal_year_start || null, accounting_standard || null, currency || null, now, req.params.id)

  const updated = db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id)
  ok(res, updated, '账套信息更新成功')
})

// ── Company user management ─────────────────────────────

// List users in a company
router.get('/:id/users', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const uc = db.prepare("SELECT role FROM user_companies WHERE user_id=? AND company_id=?").get(req.user!.userId, req.params.id) as { role: string } | undefined
  if (!uc) { res.status(403).json({ code: 403, message: '无权访问' }); return }

  const users = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.phone, u.is_enabled, uc.role, uc.permissions
    FROM user_companies uc JOIN users u ON u.id = uc.user_id
    WHERE uc.company_id = ? ORDER BY u.name
  `).all(req.params.id)
  ok(res, users)
})

// Add user to company
router.post('/:id/users', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const uc = db.prepare("SELECT role FROM user_companies WHERE user_id=? AND company_id=?").get(req.user!.userId, req.params.id) as { role: string } | undefined
  if (!uc || uc.role !== 'admin') { res.status(403).json({ code: 403, message: '仅管理员可添加用户' }); return }

  const { userId, role, permissions } = req.body
  const exists = db.prepare('SELECT 1 FROM user_companies WHERE user_id=? AND company_id=?').get(userId, req.params.id)
  if (exists) { res.status(400).json({ code: 400, message: '该用户已在此账套中' }); return }

  const now = dayjs().toISOString()
  db.prepare('INSERT INTO user_companies (id,user_id,company_id,role,permissions,created_at) VALUES (?,?,?,?,?,?)')
    .run(uuid(), userId, req.params.id, role || 'accountant', permissions ? JSON.stringify(permissions) : null, now)
  ok(res, null, '用户已添加到账套')
})

// Update user role/permissions in company
router.put('/:id/users/:userId', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const uc = db.prepare("SELECT role FROM user_companies WHERE user_id=? AND company_id=?").get(req.user!.userId, req.params.id) as { role: string } | undefined
  if (!uc || uc.role !== 'admin') { res.status(403).json({ code: 403, message: '仅管理员可修改用户角色' }); return }

  const { role, permissions } = req.body
  db.prepare('UPDATE user_companies SET role=COALESCE(?,role), permissions=? WHERE user_id=? AND company_id=?')
    .run(role || null, permissions ? JSON.stringify(permissions) : null, req.params.userId, req.params.id)
  ok(res, null, '用户角色更新成功')
})

// Remove user from company
router.delete('/:id/users/:userId', authenticate, (req: Request, res: Response) => {
  const db = getMasterDb()
  const uc = db.prepare("SELECT role FROM user_companies WHERE user_id=? AND company_id=?").get(req.user!.userId, req.params.id) as { role: string } | undefined
  if (!uc || uc.role !== 'admin') { res.status(403).json({ code: 403, message: '仅管理员可移除用户' }); return }

  // Don't allow removing yourself if you're the only admin
  if (req.params.userId === req.user!.userId) {
    const adminCount = (db.prepare("SELECT COUNT(*) as c FROM user_companies WHERE company_id=? AND role='admin'").get(req.params.id) as { c: number }).c
    if (adminCount <= 1) { res.status(400).json({ code: 400, message: '不能移除唯一管理员' }); return }
  }

  db.prepare('DELETE FROM user_companies WHERE user_id=? AND company_id=?').run(req.params.userId, req.params.id)
  ok(res, null, '用户已从账套移除')
})

export default router
