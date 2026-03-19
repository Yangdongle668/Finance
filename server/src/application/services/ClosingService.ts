import { randomUUID } from 'crypto'
import dayjs from 'dayjs'
import { getDb } from '../../infrastructure/database/db'
import { AppError } from '../../api/middleware/errorHandler'
import type { ClosingTemplate, ClosingTemplateLine, ClosingSummaryItem, CreateTemplateData, UpdateTemplateData } from '../../domain/closing/types'

// ── DB row mappers ────────────────────────────────────────

function rowToTemplate(r: Record<string, unknown>, lines: ClosingTemplateLine[]): ClosingTemplate {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as 'system' | 'custom',
    systemKey: r.system_key as string | null,
    isEnabled: (r.is_enabled as number) === 1,
    isSystem: (r.is_system as number) === 1,
    sortOrder: r.sort_order as number,
    voucherWord: r.voucher_word as string,
    summary: r.summary as string | null,
    config: r.config ? JSON.parse(r.config as string) : null,
    lines,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToLine(r: Record<string, unknown>): ClosingTemplateLine {
  return {
    id: r.id as string,
    templateId: r.template_id as string,
    lineNo: r.line_no as number,
    summary: r.summary as string,
    accountCode: r.account_code as string,
    accountName: r.account_name as string,
    direction: r.direction as 'debit' | 'credit',
    amountType: r.amount_type as 'balance_out' | 'balance_in' | 'fixed',
    ratio: r.ratio as number,
  }
}

// ── Service ───────────────────────────────────────────────

export class ClosingService {

  listTemplates(): ClosingTemplate[] {
    const db = getDb()
    const templates = db.prepare(
      'SELECT * FROM closing_templates ORDER BY sort_order, created_at'
    ).all() as Record<string, unknown>[]
    const allLines = db.prepare(
      'SELECT * FROM closing_template_lines ORDER BY template_id, line_no'
    ).all() as Record<string, unknown>[]

    return templates.map(t => {
      const lines = allLines
        .filter(l => l.template_id === t.id)
        .map(rowToLine)
      return rowToTemplate(t, lines)
    })
  }

  getTemplate(id: string): ClosingTemplate | null {
    const db = getDb()
    const t = db.prepare('SELECT * FROM closing_templates WHERE id=?').get(id) as Record<string, unknown> | undefined
    if (!t) return null
    const lines = (db.prepare('SELECT * FROM closing_template_lines WHERE template_id=? ORDER BY line_no').all(id) as Record<string, unknown>[]).map(rowToLine)
    return rowToTemplate(t, lines)
  }

  createTemplate(data: CreateTemplateData): ClosingTemplate {
    const db = getDb()
    const now = dayjs().toISOString()
    const id = randomUUID()
    db.prepare(`
      INSERT INTO closing_templates (id,name,type,system_key,is_enabled,is_system,sort_order,voucher_word,summary,config,created_at,updated_at)
      VALUES (?,?,?,null,1,0,99,?,?,null,?,?)
    `).run(id, data.name, 'custom', data.voucherWord || '记', data.summary || data.name, now, now)

    if (data.lines?.length) {
      this._replaceLines(id, data.lines)
    }
    return this.getTemplate(id)!
  }

  updateTemplate(id: string, data: UpdateTemplateData): ClosingTemplate {
    const db = getDb()
    const tpl = this.getTemplate(id)
    if (!tpl) throw new AppError(404, '模板不存在')

    const now = dayjs().toISOString()
    const updates: string[] = ['updated_at=?']
    const params: unknown[] = [now]

    if (data.name !== undefined) { updates.push('name=?'); params.push(data.name) }
    if (data.isEnabled !== undefined) { updates.push('is_enabled=?'); params.push(data.isEnabled ? 1 : 0) }
    if (data.voucherWord !== undefined) { updates.push('voucher_word=?'); params.push(data.voucherWord) }
    if (data.summary !== undefined) { updates.push('summary=?'); params.push(data.summary) }
    if (data.config !== undefined) { updates.push('config=?'); params.push(JSON.stringify(data.config)) }
    params.push(id)
    db.prepare(`UPDATE closing_templates SET ${updates.join(',')} WHERE id=?`).run(...params)

    if (data.lines !== undefined) {
      this._replaceLines(id, data.lines)
    }
    return this.getTemplate(id)!
  }

  deleteTemplate(id: string): void {
    const db = getDb()
    const tpl = this.getTemplate(id)
    if (!tpl) throw new AppError(404, '模板不存在')
    if (tpl.isSystem) throw new AppError(400, '系统模板不可删除')
    db.prepare('DELETE FROM closing_templates WHERE id=?').run(id)
  }

  private _replaceLines(templateId: string, lines: NonNullable<CreateTemplateData['lines']>): void {
    const db = getDb()
    db.prepare('DELETE FROM closing_template_lines WHERE template_id=?').run(templateId)
    const insert = db.prepare(`
      INSERT INTO closing_template_lines (id,template_id,line_no,summary,account_code,account_name,direction,amount_type,ratio)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    lines.forEach((l, i) => {
      insert.run(randomUUID(), templateId, l.lineNo ?? i + 1, l.summary || '', l.accountCode, l.accountName || '', l.direction, l.amountType || 'balance_out', l.ratio ?? 1.0)
    })
  }

  // ── Summary ───────────────────────────────────────────

  getSummary(periodId: string): ClosingSummaryItem[] {
    const db = getDb()
    const templates = this.listTemplates()

    return templates.map(tpl => {
      // Find closing voucher for this template/period
      const cv = db.prepare(
        'SELECT cv.voucher_id, v.status FROM closing_vouchers cv JOIN vouchers v ON cv.voucher_id=v.id WHERE cv.template_id=? AND cv.period_id=?'
      ).get(tpl.id, periodId) as { voucher_id: string; status: string } | undefined

      const transferred = cv ? this._getVoucherDebitTotal(cv.voucher_id) : 0
      const total = tpl.isEnabled ? this._calcTemplateAmount(tpl, periodId) : 0
      const pending = Math.max(0, total - transferred)

      return {
        templateId: tpl.id,
        name: tpl.name,
        type: tpl.type,
        systemKey: tpl.systemKey,
        isEnabled: tpl.isEnabled,
        isSystem: tpl.isSystem,
        sortOrder: tpl.sortOrder,
        transferred,
        pending,
        voucherId: cv?.voucher_id ?? null,
        voucherStatus: cv?.status ?? null,
      } satisfies ClosingSummaryItem
    })
  }

  private _getVoucherDebitTotal(voucherId: string): number {
    const db = getDb()
    const row = db.prepare(
      "SELECT COALESCE(SUM(amount),0) as total FROM voucher_lines WHERE voucher_id=? AND direction='debit'"
    ).get(voucherId) as { total: number }
    return row.total / 100
  }

  private _calcTemplateAmount(tpl: ClosingTemplate, periodId: string): number {
    if (tpl.type === 'system') {
      switch (tpl.systemKey) {
        case 'depreciation': return this._calcDepreciation(periodId)
        case 'pnl': return Math.abs(this._calcNetProfit(periodId))
        case 'cost_of_sales': return Math.abs(this._getAccountBalance('1405', periodId))
        case 'vat_out': {
          // 仅当增值税为贷方余额（应缴税款）时才需要结转
          const vatBal = this._getAccountBalance('222101', periodId)
          return vatBal < 0 ? Math.abs(vatBal) : 0
        }
        case 'surcharge_tax': {
          // 仅当增值税为贷方余额时才需计提附加税
          const vatBal2 = this._getAccountBalance('222101', periodId)
          if (vatBal2 >= 0) return 0
          const vatBase = Math.abs(vatBal2)
          return Math.round(vatBase * 0.12 * 10000) / 10000
        }
        case 'income_tax': {
          const profit = this._calcNetProfit(periodId)
          return profit > 0 ? Math.round(profit * 0.25 * 100) / 100 : 0
        }
        default: return 0
      }
    }
    // Custom: sum of balance_out lines
    return tpl.lines
      .filter(l => l.amountType === 'balance_out')
      .reduce((sum, l) => sum + Math.abs(this._getAccountBalance(l.accountCode, periodId)) * l.ratio, 0)
  }

  private _getAccountBalance(accountCode: string, periodId: string): number {
    const db = getDb()
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN vl.direction='debit' THEN vl.amount ELSE 0 END),0) as debit,
        COALESCE(SUM(CASE WHEN vl.direction='credit' THEN vl.amount ELSE 0 END),0) as credit
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id=v.id
      WHERE (vl.account_code=? OR vl.account_code LIKE ?)
        AND v.period_id=? AND v.status='posted'
    `).get(accountCode, accountCode + '%', periodId) as { debit: number; credit: number }
    return (row.debit - row.credit) / 100
  }

  private _calcDepreciation(periodId: string): number {
    const db = getDb()
    const row = db.prepare(
      'SELECT COALESCE(SUM(depreciation_amount),0) as total FROM asset_depreciations WHERE period_id=?'
    ).get(periodId) as { total: number }
    return row.total / 100
  }

  private _calcNetProfit(periodId: string): number {
    const db = getDb()
    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN vl.direction='credit' THEN vl.amount ELSE -vl.amount END),0) as total
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id=v.id
      JOIN accounts a ON vl.account_code=a.code
      WHERE v.period_id=? AND v.status='posted' AND a.nature='income'
    `).get(periodId) as { total: number }
    const expRow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN vl.direction='debit' THEN vl.amount ELSE -vl.amount END),0) as total
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id=v.id
      JOIN accounts a ON vl.account_code=a.code
      WHERE v.period_id=? AND v.status='posted' AND a.nature='expense'
    `).get(periodId) as { total: number }
    return (incomeRow.total - expRow.total) / 100
  }

  // ── Generate voucher ──────────────────────────────────

  generateVoucher(templateId: string, periodId: string, userId: string): { voucherId: string } {
    const db = getDb()
    const tpl = this.getTemplate(templateId)
    if (!tpl) throw new AppError(404, '模板不存在')
    if (!tpl.isEnabled) throw new AppError(400, '模板已禁用')

    const period = db.prepare('SELECT * FROM periods WHERE id=?').get(periodId) as
      { end_date: string; status: string } | undefined
    if (!period) throw new AppError(404, '期间不存在')
    if (period.status === 'closed') throw new AppError(400, '期间已结账，无法生成凭证')

    const lines = this._buildVoucherLines(tpl, periodId)
    if (lines.length === 0) throw new AppError(400, '计算金额为零，无需生成凭证')

    const totalDebit = lines.filter(l => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
    if (totalDebit === 0) throw new AppError(400, '凭证借方合计为零，无需生成')

    const now = dayjs().toISOString()

    // Check for existing closing voucher
    const existing = db.prepare(
      'SELECT voucher_id FROM closing_vouchers WHERE template_id=? AND period_id=?'
    ).get(templateId, periodId) as { voucher_id: string } | undefined

    let voucherId: string
    if (existing) {
      // Overwrite existing voucher lines
      voucherId = existing.voucher_id
      db.prepare('DELETE FROM voucher_lines WHERE voucher_id=?').run(voucherId)
      db.prepare("UPDATE vouchers SET status='draft',updated_at=? WHERE id=?").run(now, voucherId)
    } else {
      // Create new voucher
      voucherId = randomUUID()
      const lastNo = db.prepare(
        "SELECT COALESCE(MAX(CAST(voucher_no AS INTEGER)),0) as maxNo FROM vouchers WHERE period_id=? AND voucher_word=?"
      ).get(periodId, tpl.voucherWord) as { maxNo: number }
      const nextNo = String(lastNo.maxNo + 1)

      db.prepare(`
        INSERT INTO vouchers (id,voucher_no,voucher_word,voucher_date,period_id,summary,type,status,attachment_count,prepared_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'carry_forward','draft',0,?,?,?)
      `).run(voucherId, nextNo, tpl.voucherWord, period.end_date, periodId,
             tpl.summary || tpl.name, userId, now, now)

      db.prepare(
        'INSERT INTO closing_vouchers (id,template_id,period_id,voucher_id,created_at) VALUES (?,?,?,?,?)'
      ).run(randomUUID(), templateId, periodId, voucherId, now)
    }

    // Insert lines
    const insertLine = db.prepare(`
      INSERT INTO voucher_lines (id,voucher_id,line_no,account_code,account_name,direction,amount)
      VALUES (?,?,?,?,?,?,?)
    `)
    lines.forEach((l, i) => {
      insertLine.run(randomUUID(), voucherId, i + 1, l.accountCode, l.accountName, l.direction, l.amount)
    })

    return { voucherId }
  }

  private _buildVoucherLines(tpl: ClosingTemplate, periodId: string): {
    accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number
  }[] {
    if (tpl.type === 'system') {
      switch (tpl.systemKey) {
        case 'depreciation': return this._buildDepreciationLines(periodId)
        case 'pnl': return this._buildPnlLines(periodId)
        case 'cost_of_sales': return this._buildSimpleTransferLines('1405', '库存商品', '6401', '主营业务成本', periodId, tpl.summary || '结转销售成本')
        case 'vat_out': {
          // 缴纳增值税：将应交增值税贷方余额转为银行付款
          const vatBalance = this._getAccountBalance('222101', periodId)
          // vatBalance < 0 表示贷方有余额（应缴税款）
          const amt = Math.round(Math.abs(vatBalance) * 100)
          if (amt === 0) return []
          return vatBalance < 0 ? [
            { accountCode: '222101', accountName: '应交增值税', direction: 'debit' as const, amount: amt },
            { accountCode: '100201', accountName: '工商银行-基本账户', direction: 'credit' as const, amount: amt },
          ] : []
        }
        case 'surcharge_tax': {
          // 计提税金及附加（城建税7%+教育费附加3%+地方教育附加2%=12%）
          const vatRawBal = this._getAccountBalance('222101', periodId)
          if (vatRawBal >= 0) return [] // 无贷方余额（不欠税），无需计提
          const vatAmt = Math.abs(vatRawBal)
          const totalSurcharge = Math.round(vatAmt * 0.12 * 100) // fen
          if (totalSurcharge === 0) return []
          const urban = Math.round(totalSurcharge * 7 / 12)    // 城建税 7%
          const edu = Math.round(totalSurcharge * 3 / 12)       // 教育费附加 3%
          const localEdu = totalSurcharge - urban - edu          // 地方教育附加 2%
          const db = getDb()
          // 优先用5402（税金及附加），无则用6711（营业外支出）
          const taxExpAcc = db.prepare("SELECT code,name FROM accounts WHERE code='5402'").get() as { code: string; name: string } | undefined
          const expCode = taxExpAcc?.code || '6711'
          const expName = taxExpAcc?.name || '营业外支出'
          const result: { accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number }[] = [
            { accountCode: expCode, accountName: expName, direction: 'debit', amount: totalSurcharge },
          ]
          if (urban > 0) result.push({ accountCode: '222103', accountName: '应交城市维护建设税', direction: 'credit', amount: urban })
          if (edu > 0) {
            const eduAcc = db.prepare("SELECT code,name FROM accounts WHERE code='222104'").get() as { code: string; name: string } | undefined
            result.push({ accountCode: eduAcc?.code || '222103', accountName: eduAcc?.name || '应交教育费附加', direction: 'credit', amount: edu })
          }
          if (localEdu > 0) {
            const localAcc = db.prepare("SELECT code,name FROM accounts WHERE code='222105'").get() as { code: string; name: string } | undefined
            result.push({ accountCode: localAcc?.code || '222103', accountName: localAcc?.name || '地方教育附加', direction: 'credit', amount: localEdu })
          }
          return result
        }
        case 'income_tax': {
          const profit = this._calcNetProfit(periodId)
          if (profit <= 0) return []
          const taxAmt = Math.round(profit * 0.25 * 100)
          return [
            { accountCode: '6801', accountName: '所得税费用', direction: 'debit', amount: taxAmt },
            { accountCode: '222102', accountName: '应交企业所得税', direction: 'credit', amount: taxAmt },
          ]
        }
        default: return []
      }
    }

    // Custom template: build from lines
    const db = getDb()
    const sourceLines = tpl.lines.filter(l => l.amountType === 'balance_out')
    const destLines = tpl.lines.filter(l => l.amountType === 'balance_in')
    const fixedLines = tpl.lines.filter(l => l.amountType === 'fixed')

    const result: { accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number }[] = []

    // Source amounts (balance_out)
    let sourceTotal = 0
    for (const l of sourceLines) {
      const balance = Math.abs(this._getAccountBalance(l.accountCode, periodId))
      const amt = Math.round(balance * l.ratio * 100)
      if (amt > 0) {
        const acc = db.prepare('SELECT name FROM accounts WHERE code=?').get(l.accountCode) as { name: string } | undefined
        result.push({ accountCode: l.accountCode, accountName: l.accountName || acc?.name || l.accountCode, direction: l.direction, amount: amt })
        sourceTotal += amt
      }
    }

    // Destination amounts (balance_in) - distribute source total proportionally
    if (sourceTotal > 0 && destLines.length > 0) {
      const totalRatio = destLines.reduce((s, l) => s + l.ratio, 0) || 1
      let remaining = sourceTotal
      destLines.forEach((l, i) => {
        const acc = db.prepare('SELECT name FROM accounts WHERE code=?').get(l.accountCode) as { name: string } | undefined
        const amt = i === destLines.length - 1 ? remaining : Math.round(sourceTotal * l.ratio / totalRatio)
        remaining -= amt
        if (amt > 0) result.push({ accountCode: l.accountCode, accountName: l.accountName || acc?.name || l.accountCode, direction: l.direction, amount: amt })
      })
    }

    // Fixed lines
    for (const l of fixedLines) {
      const acc = db.prepare('SELECT name FROM accounts WHERE code=?').get(l.accountCode) as { name: string } | undefined
      if (l.ratio > 0) result.push({ accountCode: l.accountCode, accountName: l.accountName || acc?.name || l.accountCode, direction: l.direction, amount: Math.round(l.ratio * 100) })
    }

    return result
  }

  private _buildSimpleTransferLines(
    fromCode: string, fromName: string,
    toCode: string, toName: string,
    periodId: string, summary: string
  ) {
    const balance = Math.abs(this._getAccountBalance(fromCode, periodId))
    const amt = Math.round(balance * 100)
    if (amt === 0) return []
    return [
      { accountCode: toCode, accountName: toName, direction: 'debit' as const, amount: amt },
      { accountCode: fromCode, accountName: fromName, direction: 'credit' as const, amount: amt },
    ]
  }

  private _buildDepreciationLines(periodId: string): {
    accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number
  }[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT a.expense_account_code, a.depr_account_code, SUM(ad.depreciation_amount) as total
      FROM asset_depreciations ad
      JOIN assets a ON ad.asset_id=a.id
      WHERE ad.period_id=?
      GROUP BY a.expense_account_code, a.depr_account_code
    `).all(periodId) as { expense_account_code: string; depr_account_code: string; total: number }[]

    if (rows.length === 0) return []
    const result: { accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number }[] = []
    for (const r of rows) {
      const expAcc = db.prepare('SELECT name FROM accounts WHERE code=?').get(r.expense_account_code) as { name: string } | undefined
      const deprAcc = db.prepare('SELECT name FROM accounts WHERE code=?').get(r.depr_account_code) as { name: string } | undefined
      result.push({ accountCode: r.expense_account_code, accountName: expAcc?.name || r.expense_account_code, direction: 'debit', amount: r.total })
      result.push({ accountCode: r.depr_account_code, accountName: deprAcc?.name || r.depr_account_code, direction: 'credit', amount: r.total })
    }
    return result
  }

  private _buildPnlLines(periodId: string): {
    accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number
  }[] {
    const db = getDb()
    // Income accounts (credit nature) - debit them to close; use all accounts to support non-leaf entries
    const incomeAccs = db.prepare(`
      SELECT a.code, a.name,
        COALESCE(SUM(CASE WHEN vl.direction='credit' THEN vl.amount ELSE -vl.amount END),0) as balance
      FROM accounts a
      INNER JOIN voucher_lines vl ON vl.account_code=a.code
      INNER JOIN vouchers v ON vl.voucher_id=v.id AND v.period_id=? AND v.status='posted'
      WHERE a.nature='income'
      GROUP BY a.code, a.name
      HAVING balance != 0
    `).all(periodId) as { code: string; name: string; balance: number }[]

    // Expense accounts (debit nature) - credit them to close
    const expAccs = db.prepare(`
      SELECT a.code, a.name,
        COALESCE(SUM(CASE WHEN vl.direction='debit' THEN vl.amount ELSE -vl.amount END),0) as balance
      FROM accounts a
      INNER JOIN voucher_lines vl ON vl.account_code=a.code
      INNER JOIN vouchers v ON vl.voucher_id=v.id AND v.period_id=? AND v.status='posted'
      WHERE a.nature='expense'
      GROUP BY a.code, a.name
      HAVING balance != 0
    `).all(periodId) as { code: string; name: string; balance: number }[]

    const result: { accountCode: string; accountName: string; direction: 'debit' | 'credit'; amount: number }[] = []
    let incomeTotal = 0
    let expenseTotal = 0

    for (const a of incomeAccs) {
      if (a.balance > 0) {
        result.push({ accountCode: a.code, accountName: a.name, direction: 'debit', amount: a.balance })
        incomeTotal += a.balance
      }
    }
    for (const a of expAccs) {
      if (a.balance > 0) {
        result.push({ accountCode: a.code, accountName: a.name, direction: 'credit', amount: a.balance })
        expenseTotal += a.balance
      }
    }

    const netProfit = incomeTotal - expenseTotal
    if (netProfit > 0) {
      result.push({ accountCode: '4102', accountName: '本年利润', direction: 'credit', amount: netProfit })
    } else if (netProfit < 0) {
      result.push({ accountCode: '4102', accountName: '本年利润', direction: 'debit', amount: Math.abs(netProfit) })
    }

    return result
  }

  // ── Period close / reopen ────────────────────────────

  closePeriod(periodId: string, _userId: string): void {
    const db = getDb()
    const period = db.prepare('SELECT * FROM periods WHERE id=?').get(periodId) as { status: string } | undefined
    if (!period) throw new AppError(404, '期间不存在')
    if (period.status === 'closed') throw new AppError(400, '期间已是结账状态')

    // 检查是否还有未记账凭证（草稿/待审核/已审核 都不应存在）
    const unposted = db.prepare(`
      SELECT COUNT(*) as cnt FROM vouchers
      WHERE period_id=? AND status IN ('draft','pending','approved')
    `).get(periodId) as { cnt: number }
    if (unposted.cnt > 0) {
      throw new AppError(400, `当前期间还有 ${unposted.cnt} 张未记账凭证，请先全部记账或删除后再结账`)
    }

    // 结账前重算所有科目余额，保证数据一致性
    this._recalcBalancesForPeriod(periodId)

    const now = dayjs().toISOString()
    db.prepare("UPDATE periods SET status='closed',closed_at=?,updated_at=? WHERE id=?").run(now, now, periodId)

    // 将期末余额结转为下期的期初余额
    this._carryForwardBalances(periodId)
  }

  /** 重算指定期间的科目余额 */
  private _recalcBalancesForPeriod(periodId: string): void {
    const db = getDb()
    const { VoucherRepository } = require('../../infrastructure/repositories/VoucherRepository')
    const voucherRepo = new VoucherRepository()
    voucherRepo.recalcBalances(periodId)
  }

  /** 将当前期间的期末余额结转为下一期间的期初余额 */
  private _carryForwardBalances(periodId: string): void {
    const db = getDb()
    const period = db.prepare('SELECT year, month FROM periods WHERE id=?').get(periodId) as
      { year: number; month: number } | undefined
    if (!period) return

    const nextYear = period.month === 12 ? period.year + 1 : period.year
    const nextMonth = period.month === 12 ? 1 : period.month + 1
    const nextPeriod = db.prepare('SELECT id FROM periods WHERE year=? AND month=?')
      .get(nextYear, nextMonth) as { id: string } | undefined
    if (!nextPeriod) return

    // 获取当前期间所有科目的期末余额
    const balances = db.prepare(
      'SELECT account_code, closing_debit, closing_credit FROM account_balances WHERE period_id=?'
    ).all(periodId) as { account_code: string; closing_debit: number; closing_credit: number }[]

    const upsert = db.prepare(`
      INSERT INTO account_balances
        (id, account_code, period_id, opening_debit, opening_credit, debit_amount, credit_amount, closing_debit, closing_credit)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
      ON CONFLICT(account_code, period_id) DO UPDATE SET
        opening_debit=excluded.opening_debit, opening_credit=excluded.opening_credit
    `)

    for (const bal of balances) {
      upsert.run(
        `bal_${bal.account_code}_${nextPeriod.id}`,
        bal.account_code, nextPeriod.id,
        bal.closing_debit, bal.closing_credit,
        bal.closing_debit, bal.closing_credit
      )
    }
  }

  reopenPeriod(periodId: string, _userId: string): void {
    const db = getDb()
    const period = db.prepare('SELECT * FROM periods WHERE id=?').get(periodId) as { status: string } | undefined
    if (!period) throw new AppError(404, '期间不存在')
    if (period.status !== 'closed') throw new AppError(400, '期间未处于结账状态')
    const now = dayjs().toISOString()
    db.prepare("UPDATE periods SET status='open',closed_at=null,updated_at=? WHERE id=?").run(now, periodId)
  }
}
