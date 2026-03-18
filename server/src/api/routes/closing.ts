import { Router, Request, Response } from 'express'
import { ClosingService } from '../../application/services/ClosingService'
import { authenticate } from '../middleware/auth'
import { ok } from '../middleware/errorHandler'

const router = Router()
const svc = new ClosingService()

router.use(authenticate)

// GET /api/closing/templates
router.get('/templates', (_req: Request, res: Response) => {
  ok(res, svc.listTemplates())
})

// POST /api/closing/templates
router.post('/templates', (req: Request, res: Response) => {
  ok(res, svc.createTemplate(req.body))
})

// PUT /api/closing/templates/:id
router.put('/templates/:id', (req: Request, res: Response) => {
  ok(res, svc.updateTemplate(req.params.id, req.body))
})

// DELETE /api/closing/templates/:id
router.delete('/templates/:id', (req: Request, res: Response) => {
  svc.deleteTemplate(req.params.id)
  ok(res, null)
})

// GET /api/closing/summary/:periodId
router.get('/summary/:periodId', (req: Request, res: Response) => {
  ok(res, svc.getSummary(req.params.periodId))
})

// POST /api/closing/generate/:templateId?periodId=
router.post('/generate/:templateId', (req: Request, res: Response) => {
  const user = (req as Request & { user?: { id: string } }).user
  const periodId = req.body.periodId || (req.query.periodId as string)
  ok(res, svc.generateVoucher(req.params.templateId, periodId, user?.id || 'system'))
})

// POST /api/closing/:periodId/close
router.post('/:periodId/close', (req: Request, res: Response) => {
  const user = (req as Request & { user?: { id: string } }).user
  svc.closePeriod(req.params.periodId, user?.id || 'system')
  ok(res, null)
})

// POST /api/closing/:periodId/reopen
router.post('/:periodId/reopen', (req: Request, res: Response) => {
  const user = (req as Request & { user?: { id: string } }).user
  svc.reopenPeriod(req.params.periodId, user?.id || 'system')
  ok(res, null)
})

export default router
