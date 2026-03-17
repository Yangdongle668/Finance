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
