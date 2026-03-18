import { Router, Request, Response } from 'express'
import { AccountRepository } from '../../infrastructure/repositories/AccountRepository'
import { authenticate } from '../middleware/auth'
import { ok } from '../middleware/errorHandler'

const router = Router()
const repo = new AccountRepository()

router.use(authenticate)

// GET /api/accounts?enabledOnly=true
router.get('/', (req: Request, res: Response) => {
  const enabledOnly = req.query.enabledOnly === 'true'
  ok(res, repo.findAll(enabledOnly))
})

// GET /api/accounts/leaf  — 只返回末级科目（凭证录入用）
router.get('/leaf', (_req: Request, res: Response) => {
  ok(res, repo.findLeafAccounts())
})

// GET /api/accounts/:code
router.get('/:code', (req: Request, res: Response) => {
  const a = repo.findByCode(req.params.code)
  if (!a) { res.status(404).json({ code: 404, message: '科目不存在' }); return }
  ok(res, a)
})

// POST /api/accounts
router.post('/', (req: Request, res: Response) => {
  repo.create(req.body)
  res.status(201).json({ code: 0, message: '科目创建成功' })
})

// PATCH /api/accounts/:code
router.patch('/:code', (req: Request, res: Response) => {
  repo.update(req.params.code, req.body)
  ok(res, null, '科目更新成功')
})

// DELETE /api/accounts/:code
router.delete('/:code', (req: Request, res: Response) => {
  const code = req.params.code
  const account = repo.findByCode(code)
  if (!account) { res.status(404).json({ code: 404, message: '科目不存在' }); return }
  // 检查是否有子科目
  const children = repo.findAll().filter(a => a.parentCode === code)
  if (children.length > 0) { res.status(400).json({ code: 400, message: '该科目下有子科目，无法删除' }); return }
  // 检查是否有凭证引用
  const { getDb } = require('../../infrastructure/database/db')
  const db = getDb()
  const used = db.prepare('SELECT COUNT(*) as cnt FROM voucher_lines WHERE account_code=?').get(code) as { cnt: number }
  if (used.cnt > 0) { res.status(400).json({ code: 400, message: '该科目已被凭证使用，无法删除' }); return }
  repo.delete(code)
  ok(res, null, '科目删除成功')
})

// GET /api/accounts/balances/:periodId
router.get('/balances/:periodId', (req: Request, res: Response) => {
  ok(res, repo.getBalances(req.params.periodId))
})

// ── 核算项目 ──────────────────────────────────────────────

// GET /api/accounts/dimensions?type=department
router.get('/dimensions/list', (req: Request, res: Response) => {
  const type = req.query.type as never
  ok(res, repo.findDimensions(type))
})

// POST /api/accounts/dimensions
router.post('/dimensions', (req: Request, res: Response) => {
  repo.createDimension(req.body)
  res.status(201).json({ code: 0, message: '核算项目创建成功' })
})

export default router
