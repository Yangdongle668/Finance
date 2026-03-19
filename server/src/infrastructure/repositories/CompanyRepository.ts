import { getDb } from '../database/db'
import type { Company } from '../../domain/company/types'
import dayjs from 'dayjs'
import { v4 as uuid } from 'uuid'

function rowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    taxNo: row.tax_no as string | null,
    legalPerson: row.legal_person as string | null,
    industry: row.industry as string | null,
    address: row.address as string | null,
    phone: row.phone as string | null,
    fiscalYearStart: row.fiscal_year_start as number,
    accountingStandard: row.accounting_standard as Company['accountingStandard'],
    currency: row.currency as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export class CompanyRepository {
  findAll(): Company[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM company ORDER BY created_at').all() as Record<string, unknown>[]
    return rows.map(rowToCompany)
  }

  findById(id: string): Company | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM company WHERE id=?').get(id) as Record<string, unknown> | undefined
    return row ? rowToCompany(row) : null
  }

  create(data: Partial<Company> & { name: string }): Company {
    const db = getDb()
    const now = dayjs().toISOString()
    const id = uuid()
    db.prepare(`
      INSERT INTO company (id, name, tax_no, legal_person, industry, address, phone,
        fiscal_year_start, accounting_standard, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.taxNo ?? null,
      data.legalPerson ?? null,
      data.industry ?? null,
      data.address ?? null,
      data.phone ?? null,
      data.fiscalYearStart ?? 1,
      data.accountingStandard ?? 'small',
      data.currency ?? 'CNY',
      now,
      now,
    )
    return this.findById(id)!
  }

  update(id: string, data: Partial<Company>): void {
    const db = getDb()
    const now = dayjs().toISOString()
    const sets: string[] = []
    const vals: unknown[] = []

    if (data.name !== undefined)               { sets.push('name=?');                vals.push(data.name) }
    if (data.taxNo !== undefined)              { sets.push('tax_no=?');              vals.push(data.taxNo) }
    if (data.legalPerson !== undefined)        { sets.push('legal_person=?');        vals.push(data.legalPerson) }
    if (data.industry !== undefined)           { sets.push('industry=?');            vals.push(data.industry) }
    if (data.address !== undefined)            { sets.push('address=?');             vals.push(data.address) }
    if (data.phone !== undefined)              { sets.push('phone=?');               vals.push(data.phone) }
    if (data.fiscalYearStart !== undefined)    { sets.push('fiscal_year_start=?');   vals.push(data.fiscalYearStart) }
    if (data.accountingStandard !== undefined) { sets.push('accounting_standard=?'); vals.push(data.accountingStandard) }
    if (data.currency !== undefined)           { sets.push('currency=?');            vals.push(data.currency) }

    if (sets.length === 0) return
    sets.push('updated_at=?')
    vals.push(now)
    vals.push(id)
    db.prepare(`UPDATE company SET ${sets.join(', ')} WHERE id=?`).run(...vals)
  }

  delete(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM company WHERE id=?').run(id)
  }
}
