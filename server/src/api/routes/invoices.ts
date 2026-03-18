import { Router, Request, Response } from 'express'
import { getDb } from '../../infrastructure/database/db'
import { authenticate } from '../middleware/auth'
import { ok, paginate } from '../middleware/errorHandler'
import { v4 as uuid } from 'uuid'
import dayjs from 'dayjs'
import multer from 'multer'
import pdfParse from 'pdf-parse'

const router = Router()
router.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/bmp',
      'image/webp', 'image/tiff',
    ]
    if (allowed.includes(file.mimetype) || /\.(pdf|jpe?g|png|bmp|webp|tiff?)$/i.test(file.originalname)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式'))
    }
  },
})

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

// PDF 发票解析
router.post('/parse-pdf', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ code: 400, message: '请上传PDF文件' })
      return
    }

    const data = await pdfParse(req.file.buffer)
    const text = data.text

    const parsed = extractInvoiceFromText(text)
    ok(res, { ...parsed, rawText: text })
  } catch (err) {
    res.status(400).json({ code: 400, message: 'PDF解析失败，请检查文件格式或手动录入' })
  }
})

// 图片发票解析 (Tesseract OCR)
router.post('/parse-image', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ code: 400, message: '请上传图片文件' })
      return
    }

    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('chi_sim+eng')
    const { data: { text } } = await worker.recognize(req.file.buffer)
    await worker.terminate()

    const parsed = extractInvoiceFromText(text)
    ok(res, { ...parsed, rawText: text })
  } catch (err) {
    // OCR failed, return empty data for manual entry
    ok(res, {
      invoiceNo: null,
      invoiceCode: null,
      invoiceDate: null,
      sellerName: null,
      buyerName: null,
      amountExTax: 0,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: 0,
      invoiceType: 'vat_general',
      rawText: '',
      ocrFailed: true,
    })
  }
})

function extractInvoiceFromText(text: string) {
  const result: Record<string, string | number | null> = {
    invoiceNo: null,
    invoiceCode: null,
    invoiceDate: null,
    sellerName: null,
    sellerTaxNo: null,
    buyerName: null,
    buyerTaxNo: null,
    amountExTax: 0,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 0,
    invoiceType: 'vat_general',
  }

  // 发票号码
  const noMatch = text.match(/发票号码[：:\s]*(\d{8,20})/) || text.match(/No[.：:\s]*(\d{8,20})/)
  if (noMatch) result.invoiceNo = noMatch[1]

  // 发票代码
  const codeMatch = text.match(/发票代码[：:\s]*(\d{10,12})/)
  if (codeMatch) result.invoiceCode = codeMatch[1]

  // 日期
  const dateMatch = text.match(/(\d{4})[年\s/-](\d{1,2})[月\s/-](\d{1,2})[日]?/)
  if (dateMatch) {
    result.invoiceDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
  }

  // 判断发票类型
  if (text.includes('增值税专用发票') || text.includes('专用发票')) {
    result.invoiceType = 'vat_special'
  } else if (text.includes('增值税普通发票') || text.includes('普通发票')) {
    result.invoiceType = 'vat_general'
  }

  // 销方/购方名称
  const sellerMatch = text.match(/(?:销售方|销方|收款方)[：:\s]*(?:名称[：:\s]*)?([\u4e00-\u9fa5（）()]+(?:有限|公司|集团|店|部|中心))/)
  if (sellerMatch) result.sellerName = sellerMatch[1]

  const buyerMatch = text.match(/(?:购买方|购方|付款方)[：:\s]*(?:名称[：:\s]*)?([\u4e00-\u9fa5（）()]+(?:有限|公司|集团|店|部|中心))/)
  if (buyerMatch) result.buyerName = buyerMatch[1]

  // 纳税人识别号
  const sellerTaxMatch = text.match(/(?:销售方|销方)[\s\S]{0,50}?(?:纳税人识别号|统一社会信用代码)[：:\s]*([A-Za-z0-9]{15,20})/)
  if (sellerTaxMatch) result.sellerTaxNo = sellerTaxMatch[1]

  const buyerTaxMatch = text.match(/(?:购买方|购方)[\s\S]{0,50}?(?:纳税人识别号|统一社会信用代码)[：:\s]*([A-Za-z0-9]{15,20})/)
  if (buyerTaxMatch) result.buyerTaxNo = buyerTaxMatch[1]

  // 金额
  const amountMatch = text.match(/(?:合计|金额)[^\d]*?([\d,]+\.\d{2})/)
  if (amountMatch) result.amountExTax = parseFloat(amountMatch[1].replace(/,/g, ''))

  // 税额
  const taxMatch = text.match(/税额[^\d]*?([\d,]+\.\d{2})/)
  if (taxMatch) result.taxAmount = parseFloat(taxMatch[1].replace(/,/g, ''))

  // 价税合计
  const totalMatch = text.match(/(?:价税合计|合计金额)[（(]?(?:小写)?[）)]?[：:\s]*[¥￥]?([\d,]+\.\d{2})/)
  if (totalMatch) result.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''))

  // 税率
  const rateMatch = text.match(/(\d{1,2})%/)
  if (rateMatch) result.taxRate = parseInt(rateMatch[1]) / 100

  // 如果有金额和税额但没有合计，计算合计
  if (result.amountExTax && result.taxAmount && !result.totalAmount) {
    result.totalAmount = (result.amountExTax as number) + (result.taxAmount as number)
  }
  // 如果有合计和税额但没有金额，计算金额
  if (result.totalAmount && result.taxAmount && !result.amountExTax) {
    result.amountExTax = (result.totalAmount as number) - (result.taxAmount as number)
  }

  return result
}

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
  const conditions: string[] = ["status != 'voided'"]
  const params: unknown[] = []
  if (startDate) { conditions.push('invoice_date >= ?'); params.push(startDate) }
  if (endDate) { conditions.push('invoice_date <= ?'); params.push(endDate) }
  const where = `WHERE ${conditions.join(' AND ')}`
  const stats = db.prepare(`
    SELECT
      direction,
      COUNT(*) as count,
      SUM(amount_ex_tax) as total_ex_tax,
      SUM(tax_amount) as total_tax,
      SUM(total_amount) as total_amount
    FROM invoices
    ${where}
    GROUP BY direction
  `).all(...params)
  ok(res, stats)
})

export default router
