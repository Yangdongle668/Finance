import { Router, Request, Response } from 'express'
import { getDb } from '../../infrastructure/database/db'
import { authenticate } from '../middleware/auth'
import { ok, paginate } from '../middleware/errorHandler'
import { v4 as uuid } from 'uuid'
import dayjs from 'dayjs'

const router = Router()
router.use(authenticate)

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { direction, status, startDate, endDate, page = '1', pageSize = '20' } = req.query
  const conditions: string[] = []
  const params: unknown[] = []
  if (direction) { conditions.push('direction=?'); params.push(direction) }
  if (status) { conditions.push('status=?'); params.push(status) }
  if (startDate) { conditions.push('invoice_date>=?'); params.push(startDate) }
  if (endDate) { conditions.push('invoice_date<=?'); params.push(endDate) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM invoices ${where}`).get(...params) as { cnt: number }).cnt
  const p = Number(page), ps = Number(pageSize)
  const data = db.prepare(`SELECT * FROM invoices ${where} ORDER BY invoice_date DESC LIMIT ? OFFSET ?`)
    .all(...params, ps, (p - 1) * ps)
  paginate(res, data as never[], total, p, ps)
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const now = dayjs().toISOString()
  const id = uuid()
  const b = req.body
  db.prepare(`
    INSERT INTO invoices
      (id,direction,invoice_type,invoice_no,invoice_code,invoice_date,
       seller_name,seller_tax_no,buyer_name,buyer_tax_no,
       amount_ex_tax,tax_rate,tax_amount,total_amount,
       status,remark,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, b.direction, b.invoiceType, b.invoiceNo, b.invoiceCode ?? null, b.invoiceDate,
    b.sellerName, b.sellerTaxNo ?? null, b.buyerName, b.buyerTaxNo ?? null,
    Math.round(b.amountExTax * 100), b.taxRate,
    Math.round(b.taxAmount * 100), Math.round(b.totalAmount * 100),
    'pending', b.remark ?? null, now, now
  )
  res.status(201).json({ code: 0, message: '发票录入成功', data: { id } })
})

router.patch('/:id/certify', (req: Request, res: Response) => {
  const db = getDb()
  const now = dayjs().toISOString()
  db.prepare("UPDATE invoices SET status='certified',certified_date=?,updated_at=? WHERE id=?")
    .run(now, now, req.params.id)
  ok(res, null, '认证成功')
})

router.get('/stats', (req: Request, res: Response) => {
  const db = getDb()
  const { startDate, endDate } = req.query
  const dateFilter = startDate && endDate ? `AND invoice_date BETWEEN '${startDate}' AND '${endDate}'` : ''
  const stats = db.prepare(`
    SELECT
      direction,
      COUNT(*) as count,
      SUM(amount_ex_tax) as total_ex_tax,
      SUM(tax_amount) as total_tax,
      SUM(total_amount) as total_amount
    FROM invoices
    WHERE status != 'voided' ${dateFilter}
    GROUP BY direction
  `).all()
  ok(res, stats)
})

export default router
