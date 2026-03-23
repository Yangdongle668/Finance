import { getDb, withTransaction } from '../database/db'
import type { Voucher, VoucherLine, VoucherFilter } from '../../domain/voucher/types'
import dayjs from 'dayjs'

function rowToLine(r: Record<string, unknown>): VoucherLine {
  return {
    id: r.id as string,
    voucherId: r.voucher_id as string,
    lineNo: r.line_no as number,
    accountCode: r.account_code as string,
    accountName: r.account_name as string,
    direction: r.direction as VoucherLine['direction'],
    amount: r.amount as number,
    departmentId: r.department_id as string | null,
    projectId: r.project_id as string | null,
    customerId: r.customer_id as string | null,
    supplierId: r.supplier_id as string | null,
    remark: r.remark as string | null,
  }
}

function rowToVoucher(r: Record<string, unknown>, lines?: VoucherLine[]): Voucher {
  return {
    id: r.id as string,
    voucherNo: r.voucher_no as string,
    voucherWord: (r.voucher_word as Voucher['voucherWord']) ?? '记',
    voucherDate: r.voucher_date as string,
    periodId: r.period_id as string,
    summary: r.summary as string,
    type: r.type as Voucher['type'],
    status: r.status as Voucher['status'],
    attachmentCount: r.attachment_count as number,
    attachmentDesc: r.attachment_desc as string | null,
    preparedBy: r.prepared_by as string,
    reviewedBy: r.reviewed_by as string | null,
    postedBy: r.posted_by as string | null,
    reversedBy: r.reversed_by as string | null,
    reverseVoucherId: r.reverse_voucher_id as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lines,
  }
}

export class VoucherRepository {
  findById(id: string): Voucher | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM vouchers WHERE id=?').get(id) as Record<string, unknown> | undefined
    if (!row) return null
    const lines = (db.prepare('SELECT * FROM voucher_lines WHERE voucher_id=? ORDER BY line_no').all(id) as Record<string, unknown>[]).map(rowToLine)
    return rowToVoucher(row, lines)
  }

  findMany(filter: VoucherFilter): { data: Voucher[]; total: number } {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter.periodId) { conditions.push('v.period_id=?'); params.push(filter.periodId) }
    if (filter.startDate) { conditions.push('v.voucher_date>=?'); params.push(filter.startDate) }
    if (filter.endDate) { conditions.push('v.voucher_date<=?'); params.push(filter.endDate) }
    if (filter.status) {
      const statuses = (filter.status as string).split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length > 1) {
        conditions.push(`v.status IN (${statuses.map(() => '?').join(',')})`)
        params.push(...statuses)
      } else {
        conditions.push('v.status=?')
        params.push(statuses[0])
      }
    }
    if (filter.type) { conditions.push('v.type=?'); params.push(filter.type) }
    if (filter.voucherWord) { conditions.push('v.voucher_word=?'); params.push(filter.voucherWord) }
    if (filter.keyword) {
      conditions.push('(v.voucher_no LIKE ? OR v.summary LIKE ?)')
      params.push(`%${filter.keyword}%`, `%${filter.keyword}%`)
    }
    if (filter.accountCode) {
      conditions.push('EXISTS (SELECT 1 FROM voucher_lines vl WHERE vl.voucher_id=v.id AND vl.account_code LIKE ?)')
      params.push(`${filter.accountCode}%`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM vouchers v ${where}`).get(...params) as { cnt: number }).cnt

    const page = filter.page ?? 1
    const pageSize = filter.pageSize ?? 20
    const offset = (page - 1) * pageSize

    const rows = db.prepare(
      `SELECT * FROM vouchers v ${where} ORDER BY v.voucher_date DESC, v.voucher_no DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as Record<string, unknown>[]

    const data = rows.map(r => {
      if (filter.includeLines) {
        const lines = (db.prepare('SELECT * FROM voucher_lines WHERE voucher_id=? ORDER BY line_no').all(r.id as string) as Record<string, unknown>[]).map(rowToLine)
        return rowToVoucher(r, lines)
      }
      return rowToVoucher(r)
    })
    return { data, total }
  }

  create(voucher: Voucher): void {
    withTransaction(db => {
      const now = dayjs().toISOString()
      db.prepare(`
        INSERT INTO vouchers
          (id,voucher_no,voucher_word,voucher_date,period_id,summary,type,status,attachment_count,
           attachment_desc,prepared_by,reverse_voucher_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        voucher.id, voucher.voucherNo, voucher.voucherWord ?? '记', voucher.voucherDate, voucher.periodId,
        voucher.summary, voucher.type, voucher.status, voucher.attachmentCount,
        voucher.attachmentDesc, voucher.preparedBy, voucher.reverseVoucherId, now, now
      )

      const insertLine = db.prepare(`
        INSERT INTO voucher_lines
          (id,voucher_id,line_no,account_code,account_name,direction,amount,
           department_id,project_id,customer_id,supplier_id,remark)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `)
      for (const line of voucher.lines ?? []) {
        insertLine.run(
          line.id, voucher.id, line.lineNo, line.accountCode, line.accountName,
          line.direction, line.amount, line.departmentId, line.projectId,
          line.customerId, line.supplierId, line.remark
        )
      }
    })
  }

  update(voucher: Voucher): void {
    withTransaction(db => {
      const now = dayjs().toISOString()
      db.prepare(`
        UPDATE vouchers SET
          voucher_word=?, voucher_date=?, summary=?, attachment_count=?,
          attachment_desc=?, updated_at=?
        WHERE id=?
      `).run(
        voucher.voucherWord ?? '记', voucher.voucherDate, voucher.summary,
        voucher.attachmentCount, voucher.attachmentDesc, now, voucher.id
      )

      // Replace all lines
      db.prepare('DELETE FROM voucher_lines WHERE voucher_id=?').run(voucher.id)
      const insertLine = db.prepare(`
        INSERT INTO voucher_lines
          (id,voucher_id,line_no,account_code,account_name,direction,amount,
           department_id,project_id,customer_id,supplier_id,remark)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `)
      for (const line of voucher.lines ?? []) {
        insertLine.run(
          line.id, voucher.id, line.lineNo, line.accountCode, line.accountName,
          line.direction, line.amount, line.departmentId, line.projectId,
          line.customerId, line.supplierId, line.remark
        )
      }
    })
  }

  delete(id: string): void {
    withTransaction(db => {
      db.prepare('DELETE FROM voucher_lines WHERE voucher_id=?').run(id)
      db.prepare('DELETE FROM vouchers WHERE id=?').run(id)
    })
  }

  updateStatus(id: string, status: Voucher['status'], userId: string): void {
    const db = getDb()
    const now = dayjs().toISOString()
    const field = status === 'approved' ? ', reviewed_by=?' :
                  status === 'posted' ? ', posted_by=?' :
                  status === 'reversed' ? ', reversed_by=?' : ''
    const params: unknown[] = status === 'approved' ? [status, userId, now, id] :
                              status === 'posted' ? [status, userId, now, id] :
                              status === 'reversed' ? [status, userId, now, id] :
                              [status, now, id]
    db.prepare(`UPDATE vouchers SET status=?${field}, updated_at=? WHERE id=?`).run(...params)
  }

  /** 生成凭证号序号（用 MAX 而非 COUNT，避免删除后产生重复号） */
  nextVoucherSeq(periodId: string, voucherWord: string): number {
    const db = getDb()
    const result = db.prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(voucher_no, INSTR(voucher_no, '-') + 1) AS INTEGER)), 0) as maxSeq
       FROM vouchers WHERE period_id=? AND voucher_word=?`
    ).get(periodId, voucherWord) as { maxSeq: number }
    return result.maxSeq + 1
  }

  /** 生成凭证号（如"记-1"） */
  nextVoucherNo(periodId: string, voucherWord = '记'): string {
    const seq = this.nextVoucherSeq(periodId, voucherWord)
    return `${voucherWord}-${seq}`
  }

  /** 更新科目余额（记账时调用） */
  recalcBalances(periodId: string): void {
    withTransaction(db => {
      // 查询上期期末余额，用于本期期初余额结转
      const period = db.prepare('SELECT year, month FROM periods WHERE id=?').get(periodId) as
        { year: number; month: number } | undefined
      const prevPeriodBalMap = new Map<string, { debit: number; credit: number }>()
      if (period) {
        const prevYear = period.month === 1 ? period.year - 1 : period.year
        const prevMonth = period.month === 1 ? 12 : period.month - 1
        const prevPeriod = db.prepare('SELECT id FROM periods WHERE year=? AND month=?')
          .get(prevYear, prevMonth) as { id: string } | undefined
        if (prevPeriod) {
          const prevBals = db.prepare(
            'SELECT account_code, closing_debit, closing_credit FROM account_balances WHERE period_id=?'
          ).all(prevPeriod.id) as { account_code: string; closing_debit: number; closing_credit: number }[]
          for (const pb of prevBals) {
            prevPeriodBalMap.set(pb.account_code, { debit: pb.closing_debit, credit: pb.closing_credit })
          }
        }
      }

      // 清空本期所有余额记录，确保干净重算（防止父级余额重复累加）
      db.prepare('DELETE FROM account_balances WHERE period_id=?').run(periodId)

      // 汇总该期间所有已记账凭证的行
      const sums = db.prepare(`
        SELECT vl.account_code, vl.direction, SUM(vl.amount) as total
        FROM voucher_lines vl
        JOIN vouchers v ON vl.voucher_id = v.id
        WHERE v.period_id = ? AND v.status = 'posted'
        GROUP BY vl.account_code, vl.direction
      `).all(periodId) as { account_code: string; direction: string; total: number }[]

      const map = new Map<string, { debit: number; credit: number }>()
      for (const s of sums) {
        const entry = map.get(s.account_code) ?? { debit: 0, credit: 0 }
        if (s.direction === 'debit') entry.debit = s.total
        else entry.credit = s.total
        map.set(s.account_code, entry)
      }

      // 确保上期有余额但本期无发生额的科目也会被处理（余额结转）
      for (const [code] of prevPeriodBalMap.entries()) {
        if (!map.has(code)) {
          map.set(code, { debit: 0, credit: 0 })
        }
      }

      const insertBal = db.prepare(`
        INSERT INTO account_balances
          (id,account_code,period_id,opening_debit,opening_credit,debit_amount,credit_amount,closing_debit,closing_credit)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(account_code,period_id) DO UPDATE SET
          opening_debit  = opening_debit  + excluded.opening_debit,
          opening_credit = opening_credit + excluded.opening_credit,
          debit_amount   = debit_amount   + excluded.debit_amount,
          credit_amount  = credit_amount  + excluded.credit_amount,
          closing_debit  = closing_debit  + excluded.closing_debit,
          closing_credit = closing_credit + excluded.closing_credit
      `)

      for (const [code, { debit, credit }] of map.entries()) {
        const prevBal = prevPeriodBalMap.get(code)
        const openDebit = prevBal?.debit ?? 0
        const openCredit = prevBal?.credit ?? 0
        const closingDebit = Math.max(0, openDebit + debit - credit)
        const closingCredit = Math.max(0, openCredit + credit - debit)

        insertBal.run(
          `bal_${code}_${periodId}`, code, periodId,
          openDebit, openCredit, debit, credit, closingDebit, closingCredit
        )
      }

      // ── 向上汇总：将子科目余额累加到父科目（确保总账/余额表正确）──
      // 按层级从深到浅处理，使多层嵌套也能正确逐级汇总
      const accountsForRollup = db.prepare(
        'SELECT code, parent_code FROM accounts WHERE parent_code IS NOT NULL ORDER BY level DESC'
      ).all() as { code: string; parent_code: string }[]

      for (const acc of accountsForRollup) {
        const child = db.prepare(
          `SELECT opening_debit,opening_credit,debit_amount,credit_amount,closing_debit,closing_credit
           FROM account_balances WHERE account_code=? AND period_id=?`
        ).get(acc.code, periodId) as Record<string, number> | undefined
        if (!child) continue

        insertBal.run(
          `bal_${acc.parent_code}_${periodId}`, acc.parent_code, periodId,
          child.opening_debit, child.opening_credit,
          child.debit_amount, child.credit_amount,
          child.closing_debit, child.closing_credit
        )
      }
    })
  }
}
