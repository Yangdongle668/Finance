import { getDb } from '../database/db'
import type { Account, AccountBalance, Dimension } from '../../domain/account/types'
import dayjs from 'dayjs'

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    code: row.code as string,
    name: row.name as string,
    level: row.level as number,
    nature: row.nature as Account['nature'],
    direction: row.direction as Account['direction'],
    parentCode: row.parent_code as string | null,
    isLeaf: Boolean(row.is_leaf),
    isEnabled: Boolean(row.is_enabled),
    hasCostCenter: Boolean(row.has_cost_center),
    hasProject: Boolean(row.has_project),
    hasCustomer: Boolean(row.has_customer),
    hasSupplier: Boolean(row.has_supplier),
    remark: row.remark as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export class AccountRepository {
  findAll(enabledOnly = false): Account[] {
    const db = getDb()
    const sql = enabledOnly
      ? 'SELECT * FROM accounts WHERE is_enabled=1 ORDER BY code'
      : 'SELECT * FROM accounts ORDER BY code'
    return (db.prepare(sql).all() as Record<string, unknown>[]).map(rowToAccount)
  }

  findByCode(code: string): Account | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM accounts WHERE code=?').get(code) as Record<string, unknown> | undefined
    return row ? rowToAccount(row) : null
  }

  findByNature(nature: Account['nature']): Account[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM accounts WHERE nature=? AND is_enabled=1 ORDER BY code').all(nature) as Record<string, unknown>[]).map(rowToAccount)
  }

  findLeafAccounts(): Account[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM accounts WHERE is_leaf=1 AND is_enabled=1 ORDER BY code').all() as Record<string, unknown>[]).map(rowToAccount)
  }

  create(account: Account): void {
    const db = getDb()
    const now = dayjs().toISOString()
    db.prepare(`
      INSERT INTO accounts (code,name,level,nature,direction,parent_code,is_leaf,is_enabled,
        has_cost_center,has_project,has_customer,has_supplier,remark,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      account.code, account.name, account.level, account.nature, account.direction,
      account.parentCode, account.isLeaf ? 1 : 0, account.isEnabled ? 1 : 0,
      account.hasCostCenter ? 1 : 0, account.hasProject ? 1 : 0,
      account.hasCustomer ? 1 : 0, account.hasSupplier ? 1 : 0,
      account.remark, now, now
    )
  }

  update(code: string, data: Partial<Account>): void {
    const db = getDb()
    const now = dayjs().toISOString()
    const allowed = ['name', 'is_leaf', 'is_enabled', 'has_cost_center',
                     'has_project', 'has_customer', 'has_supplier', 'remark']
    const sets: string[] = []
    const vals: unknown[] = []
    if (data.name !== undefined) { sets.push('name=?'); vals.push(data.name) }
    if (data.isLeaf !== undefined) { sets.push('is_leaf=?'); vals.push(data.isLeaf ? 1 : 0) }
    if (data.isEnabled !== undefined) { sets.push('is_enabled=?'); vals.push(data.isEnabled ? 1 : 0) }
    if (data.hasCostCenter !== undefined) { sets.push('has_cost_center=?'); vals.push(data.hasCostCenter ? 1 : 0) }
    if (data.hasProject !== undefined) { sets.push('has_project=?'); vals.push(data.hasProject ? 1 : 0) }
    if (data.hasCustomer !== undefined) { sets.push('has_customer=?'); vals.push(data.hasCustomer ? 1 : 0) }
    if (data.hasSupplier !== undefined) { sets.push('has_supplier=?'); vals.push(data.hasSupplier ? 1 : 0) }
    if (data.remark !== undefined) { sets.push('remark=?'); vals.push(data.remark) }
    if (sets.length === 0) return
    sets.push('updated_at=?'); vals.push(now)
    vals.push(code)
    db.prepare(`UPDATE accounts SET ${sets.join(',')} WHERE code=?`).run(...vals)
    void allowed
  }

  // ── 科目余额 ──────────────────────────────────────────────

  getBalances(periodId: string): AccountBalance[] {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM account_balances WHERE period_id=? ORDER BY account_code'
    ).all(periodId) as AccountBalance[]
  }

  getBalance(accountCode: string, periodId: string): AccountBalance | null {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM account_balances WHERE account_code=? AND period_id=?'
    ).get(accountCode, periodId) as AccountBalance | null
  }

  upsertBalance(balance: Omit<AccountBalance, 'id'> & { id?: string }): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO account_balances
        (id,account_code,period_id,opening_debit,opening_credit,debit_amount,credit_amount,closing_debit,closing_credit)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(account_code,period_id) DO UPDATE SET
        debit_amount=excluded.debit_amount,
        credit_amount=excluded.credit_amount,
        closing_debit=excluded.closing_debit,
        closing_credit=excluded.closing_credit
    `).run(
      balance.id || `bal_${balance.accountCode}_${balance.periodId}`,
      balance.accountCode, balance.periodId,
      balance.openingDebit, balance.openingCredit,
      balance.debitAmount, balance.creditAmount,
      balance.closingDebit, balance.closingCredit
    )
  }

  // ── 核算项目 ──────────────────────────────────────────────

  findDimensions(type?: Dimension['type']): Dimension[] {
    const db = getDb()
    const sql = type
      ? 'SELECT * FROM dimensions WHERE type=? ORDER BY code'
      : 'SELECT * FROM dimensions ORDER BY type, code'
    const rows = (type ? db.prepare(sql).all(type) : db.prepare(sql).all()) as Record<string, unknown>[]
    return rows.map(r => ({
      id: r.id as string,
      type: r.type as Dimension['type'],
      code: r.code as string,
      name: r.name as string,
      parentId: r.parent_id as string | null,
      isEnabled: Boolean(r.is_enabled),
      remark: r.remark as string | null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }))
  }

  createDimension(dim: Dimension): void {
    const db = getDb()
    const now = dayjs().toISOString()
    db.prepare(`
      INSERT INTO dimensions (id,type,code,name,parent_id,is_enabled,remark,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(dim.id, dim.type, dim.code, dim.name, dim.parentId, dim.isEnabled ? 1 : 0, dim.remark, now, now)
  }
}
