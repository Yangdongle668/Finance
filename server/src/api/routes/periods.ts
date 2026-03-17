import { Router, Request, Response } from 'express'
import { PeriodRepository } from '../../infrastructure/repositories/PeriodRepository'
import { authenticate } from '../middleware/auth'
import { ok } from '../middleware/errorHandler'

const router = Router()
const repo = new PeriodRepository()

router.use(authenticate)

router.get('/', (_req: Request, res: Response) => {
  ok(res, repo.findAll())
})

router.get('/current', (_req: Request, res: Response) => {
  const p = repo.findCurrent()
  if (!p) { res.status(404).json({ code: 404, message: '当前期间未设置' }); return }
  ok(res, p)
})

router.post('/ensure/:year', (req: Request, res: Response) => {
  repo.ensurePeriodsForYear(Number(req.params.year))
  ok(res, repo.findAll().filter(p => p.year === Number(req.params.year)), '期间初始化完成')
})

router.post('/:id/close', (req: Request, res: Response) => {
  const period = repo.findById(req.params.id)
  if (!period) { res.status(404).json({ code: 404, message: '期间不存在' }); return }
  if (period.status === 'closed') { res.status(400).json({ code: 400, message: '期间已结账' }); return }
  repo.updateStatus(req.params.id, 'closed', req.user!.userId)
  ok(res, null, '结账完成')
})

router.post('/:id/reopen', (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ code: 403, message: '只有管理员可以反结账' }); return }
  repo.updateStatus(req.params.id, 'open')
  ok(res, null, '反结账成功')
})

export default router
