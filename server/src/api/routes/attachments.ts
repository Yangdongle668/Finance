import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { AttachmentRepository } from '../../infrastructure/repositories/AttachmentRepository'
import { authenticate } from '../middleware/auth'
import { ok, paginate } from '../middleware/errorHandler'
import type { Attachment, AttachmentCategory } from '../../domain/voucher/types'

const router = Router()
const repo = new AttachmentRepository()

router.use(authenticate)

// GET /api/attachments
router.get('/', (req: Request, res: Response) => {
  const { categoryId, periodId, name, startDate, endDate, page, pageSize } = req.query
  const result = repo.findMany({
    categoryId: categoryId as string,
    periodId: periodId as string,
    name: name as string,
    startDate: startDate as string,
    endDate: endDate as string,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  })
  paginate(res, result.data, result.total, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20)
})

// POST /api/attachments
router.post('/', (req: Request, res: Response) => {
  const now = new Date().toISOString()
  const attachment: Attachment = {
    id: uuid(),
    name: req.body.name,
    remark: req.body.remark ?? null,
    categoryId: req.body.categoryId ?? null,
    amount: req.body.amount ? Math.round(req.body.amount * 100) : 0,
    periodId: req.body.periodId ?? null,
    voucherId: req.body.voucherId ?? null,
    uploadDate: req.body.uploadDate ?? now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  }
  repo.create(attachment)
  res.status(201).json({ code: 0, message: '附件创建成功', data: attachment })
})

// DELETE /api/attachments/:id
router.delete('/:id', (req: Request, res: Response) => {
  repo.delete(req.params.id)
  ok(res, null, '附件删除成功')
})

// PATCH /api/attachments/:id/link
router.patch('/:id/link', (req: Request, res: Response) => {
  repo.linkVoucher(req.params.id, req.body.voucherId ?? null)
  ok(res, null, '关联成功')
})

// GET /api/attachments/categories
router.get('/categories', (_req: Request, res: Response) => {
  ok(res, repo.findCategories())
})

// POST /api/attachments/categories
router.post('/categories', (req: Request, res: Response) => {
  const category: AttachmentCategory = {
    id: uuid(),
    name: req.body.name,
    parentId: req.body.parentId ?? null,
    sortOrder: req.body.sortOrder ?? 0,
  }
  repo.createCategory(category)
  res.status(201).json({ code: 0, message: '分类创建成功', data: category })
})

export default router
