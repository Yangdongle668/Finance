import { Router, Request, Response } from 'express'
import { getDb, withTransaction } from '../../infrastructure/database/db'
import { authenticate } from '../middleware/auth'
import { ok } from '../middleware/errorHandler'
import { v4 as uuid } from 'uuid'
import dayjs from 'dayjs'

const router = Router()
router.use(authenticate)

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { status, category } = req.query
  let sql = 'SELECT * FROM assets WHERE 1=1'
  const params: unknown[] = []
  if (status) { sql += ' AND status=?'; params.push(status) }
  if (category) { sql += ' AND category=?'; params.push(category) }
  sql += ' ORDER BY asset_no'
  ok(res, db.prepare(sql).all(...params))
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const asset = db.prepare('SELECT * FROM assets WHERE id=?').get(req.params.id)
  if (!asset) { res.status(404).json({ code: 404, message: '资产不存在' }); return }
  const depreciations = db.prepare('SELECT * FROM asset_depreciations WHERE asset_id=? ORDER BY period_id').all(req.params.id)
  ok(res, { ...asset as object, depreciations })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const now = dayjs().toISOString()
  const id = uuid()
  const body = req.body
  db.prepare(`
    INSERT INTO assets (id,asset_no,name,category,original_value,salvage_rate,useful_life,
      depreciation_method,acquired_date,start_deprec_date,department_id,location,
      account_code,depr_account_code,expense_account_code,status,barcode,remark,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, body.assetNo, body.name, body.category,
    Math.round(body.originalValue * 100),  // 元→分
    body.salvageRate ?? 0.05,
    body.usefulLife,
    body.depreciationMethod ?? 'straight_line',
    body.acquiredDate, body.startDeprecDate,
    body.departmentId ?? null, body.location ?? null,
    body.accountCode, body.deprAccountCode, body.expenseAccountCode,
    'active', body.barcode ?? null, body.remark ?? null, now, now
  )
  res.status(201).json({ code: 0, message: '资产登记成功', data: { id } })
})

/** 计算并生成当期折旧 */
router.post('/:id/depreciate', (req: Request, res: Response) => {
  const { periodId } = req.body
  const db = getDb()

  const asset = db.prepare('SELECT * FROM assets WHERE id=?').get(req.params.id) as {
    id: string; original_value: number; salvage_rate: number
    useful_life: number; depreciation_method: string
  } | undefined
  if (!asset) { res.status(404).json({ code: 404, message: '资产不存在' }); return }

  const accumulated = (db.prepare(
    'SELECT COALESCE(SUM(depreciation_amount),0) as total FROM asset_depreciations WHERE asset_id=?'
  ).get(asset.id) as { total: number }).total

  const depreciableAmount = asset.original_value * (1 - asset.salvage_rate)
  const monthlyDepr = Math.round(depreciableAmount / asset.useful_life)
  const netValue = asset.original_value - accumulated - monthlyDepr

  withTransaction(db => {
    db.prepare(`
      INSERT OR IGNORE INTO asset_depreciations
        (id,asset_id,period_id,depreciation_amount,accumulated_depreciation,net_value,created_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(uuid(), asset.id, periodId, monthlyDepr, accumulated + monthlyDepr, Math.max(0, netValue), dayjs().toISOString())
  })

  ok(res, { monthlyDepr: monthlyDepr / 100, accumulated: (accumulated + monthlyDepr) / 100, netValue: Math.max(0, netValue) / 100 })
})

export default router
