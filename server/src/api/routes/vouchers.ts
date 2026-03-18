import { Router, Request, Response } from 'express'
import { VoucherService } from '../../application/services/VoucherService'
import { authenticate } from '../middleware/auth'
import { ok, paginate } from '../middleware/errorHandler'

const router = Router()
const svc = new VoucherService()

router.use(authenticate)

// GET /api/vouchers?periodId=&page=&pageSize=&status=&keyword=&accountCode=&includeLines=
router.get('/', (req: Request, res: Response) => {
  const { periodId, page, pageSize, status, keyword, accountCode, startDate, endDate, type, voucherWord, includeLines } = req.query
  const result = svc.list({
    periodId: periodId as string,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
    status: status as string as never,
    keyword: keyword as string,
    accountCode: accountCode as string,
    startDate: startDate as string,
    endDate: endDate as string,
    type: type as string as never,
    voucherWord: voucherWord as string as never,
    includeLines: includeLines === 'true',
  })
  paginate(res, result.data, result.total, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20)
})

// GET /api/vouchers/next-no?periodId=&voucherWord=
router.get('/next-no', (req: Request, res: Response) => {
  const { periodId, voucherWord } = req.query
  if (!periodId) { res.status(400).json({ code: 400, message: '缺少 periodId' }); return }
  const no = svc.getNextVoucherNo(periodId as string, (voucherWord as string) || '记')
  ok(res, { voucherNo: no })
})

// GET /api/vouchers/:id
router.get('/:id', (req: Request, res: Response) => {
  const v = svc.getById(req.params.id)
  if (!v) { res.status(404).json({ code: 404, message: '凭证不存在' }); return }
  ok(res, v)
})

// POST /api/vouchers
router.post('/', (req: Request, res: Response) => {
  const voucher = svc.create({ ...req.body, preparedBy: req.user!.userId })
  res.status(201).json({ code: 0, message: '凭证创建成功', data: voucher })
})

// PUT /api/vouchers/:id
router.put('/:id', (req: Request, res: Response) => {
  const voucher = svc.update(req.params.id, req.body)
  ok(res, voucher, '凭证更新成功')
})

// DELETE /api/vouchers/:id
router.delete('/:id', (req: Request, res: Response) => {
  svc.delete(req.params.id)
  ok(res, null, '凭证删除成功')
})

// POST /api/vouchers/:id/submit
router.post('/:id/submit', (req: Request, res: Response) => {
  svc.submit(req.params.id)
  ok(res, null, '已提交审核')
})

// POST /api/vouchers/:id/approve
router.post('/:id/approve', (req: Request, res: Response) => {
  svc.approve(req.params.id, req.user!.userId)
  ok(res, null, '审核通过')
})

// POST /api/vouchers/:id/reject
router.post('/:id/reject', (req: Request, res: Response) => {
  svc.reject(req.params.id, req.user!.userId)
  ok(res, null, '已驳回')
})

// POST /api/vouchers/:id/post
router.post('/:id/post', (req: Request, res: Response) => {
  svc.post(req.params.id, req.user!.userId)
  ok(res, null, '记账成功')
})

// POST /api/vouchers/batch-post
router.post('/batch-post', (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] }
  const result = svc.batchPost(ids, req.user!.userId)
  ok(res, result, `成功记账 ${result.success} 张`)
})

// POST /api/vouchers/:id/reverse
router.post('/:id/reverse', (req: Request, res: Response) => {
  const reversal = svc.reverse(req.params.id, req.user!.userId)
  ok(res, reversal, '反向记账成功')
})

export default router
