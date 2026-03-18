import { getDb } from '../database/db'
import type { Attachment, AttachmentCategory, AttachmentFilter } from '../../domain/voucher/types'
import dayjs from 'dayjs'

function rowToAttachment(r: Record<string, unknown>): Attachment {
  return {
    id: r.id as string,
    name: r.name as string,
    remark: r.remark as string | null,
    categoryId: r.category_id as string | null,
    amount: r.amount as number,
    periodId: r.period_id as string | null,
    voucherId: r.voucher_id as string | null,
    uploadDate: r.upload_date as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToCategory(r: Record<string, unknown>): AttachmentCategory {
  return {
    id: r.id as string,
    name: r.name as string,
    parentId: r.parent_id as string | null,
    sortOrder: r.sort_order as number,
  }
}

export class AttachmentRepository {
  findMany(filter: AttachmentFilter): { data: Attachment[]; total: number } {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter.categoryId) { conditions.push('category_id=?'); params.push(filter.categoryId) }
    if (filter.periodId) { conditions.push('period_id=?'); params.push(filter.periodId) }
    if (filter.name) { conditions.push('name LIKE ?'); params.push(`%${filter.name}%`) }
    if (filter.startDate) { conditions.push('upload_date>=?'); params.push(filter.startDate) }
    if (filter.endDate) { conditions.push('upload_date<=?'); params.push(filter.endDate) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM attachments ${where}`).get(...params) as { cnt: number }).cnt

    const page = filter.page ?? 1
    const pageSize = filter.pageSize ?? 20
    const offset = (page - 1) * pageSize

    const rows = db.prepare(
      `SELECT * FROM attachments ${where} ORDER BY upload_date DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as Record<string, unknown>[]

    return { data: rows.map(rowToAttachment), total }
  }

  create(attachment: Attachment): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO attachments (id, name, remark, category_id, amount, period_id, voucher_id, upload_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attachment.id, attachment.name, attachment.remark, attachment.categoryId,
      attachment.amount, attachment.periodId, attachment.voucherId,
      attachment.uploadDate, attachment.createdAt, attachment.updatedAt
    )
  }

  delete(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM attachments WHERE id=?').run(id)
  }

  linkVoucher(id: string, voucherId: string | null): void {
    const db = getDb()
    db.prepare('UPDATE attachments SET voucher_id=?, updated_at=? WHERE id=?')
      .run(voucherId, dayjs().toISOString(), id)
  }

  // Categories
  findCategories(): AttachmentCategory[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM attachment_categories ORDER BY sort_order, name').all() as Record<string, unknown>[]
    return rows.map(rowToCategory)
  }

  createCategory(category: AttachmentCategory): void {
    const db = getDb()
    const now = dayjs().toISOString()
    db.prepare(`
      INSERT INTO attachment_categories (id, name, parent_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(category.id, category.name, category.parentId, category.sortOrder, now, now)
  }
}
