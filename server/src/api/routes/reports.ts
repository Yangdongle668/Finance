import { Router, Request, Response } from 'express'
import { ReportService } from '../../application/services/ReportService'
import { authenticate } from '../middleware/auth'
import { ok } from '../middleware/errorHandler'

const router = Router()
const svc = new ReportService()

router.use(authenticate)

// GET /api/reports/trial-balance/:periodId
router.get('/trial-balance/:periodId', (req: Request, res: Response) => {
  ok(res, svc.trialBalance(req.params.periodId))
})

// GET /api/reports/ledger/:accountCode?periodId=
router.get('/ledger/:accountCode', (req: Request, res: Response) => {
  const { periodId } = req.query
  if (!periodId) { res.status(400).json({ code: 400, message: '缺少 periodId' }); return }
  ok(res, svc.ledgerDetail(req.params.accountCode, periodId as string))
})

// GET /api/reports/general-ledger/:periodId?prevPeriodId=
router.get('/general-ledger/:periodId', (req: Request, res: Response) => {
  ok(res, svc.generalLedger(req.params.periodId, req.query.prevPeriodId as string))
})

// GET /api/reports/balance-sheet/:periodId
router.get('/balance-sheet/:periodId', (req: Request, res: Response) => {
  ok(res, svc.balanceSheet(req.params.periodId))
})

// GET /api/reports/income-statement/:periodId
router.get('/income-statement/:periodId', (req: Request, res: Response) => {
  ok(res, svc.incomeStatement(req.params.periodId))
})

// GET /api/reports/cash-flow/:periodId
router.get('/cash-flow/:periodId', (req: Request, res: Response) => {
  ok(res, svc.cashFlowStatement(req.params.periodId))
})

// GET /api/reports/voucher-summary/:periodId?startDate=&endDate=
router.get('/voucher-summary/:periodId', (req: Request, res: Response) => {
  const { startDate, endDate } = req.query
  ok(res, svc.voucherSummary(req.params.periodId, startDate as string | undefined, endDate as string | undefined))
})

// GET /api/reports/dashboard/:periodId
router.get('/dashboard/:periodId', (req: Request, res: Response) => {
  ok(res, svc.dashboard(req.params.periodId))
})

export default router
