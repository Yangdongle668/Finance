import { getDb } from '../database/db'
import type { Period } from '../../domain/period/types'
import dayjs from 'dayjs'

function rowToPeriod(r: Record<string, unknown>): Period {
  return {
    id: r.id as string,
    year: r.year as number,
    month: r.month as number,
    name: r.name as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    status: r.status as Period['status'],
    closedAt: r.closed_at as string | null,
    closedBy: r.closed_by as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export class PeriodRepository {
  findAll(): Period[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM periods ORDER BY year DESC, month DESC').all() as Record<string, unknown>[]).map(rowToPeriod)
  }

  findById(id: string): Period | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM periods WHERE id=?').get(id) as Record<string, unknown> | undefined
    return row ? rowToPeriod(row) : null
  }

  findByYearMonth(year: number, month: number): Period | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM periods WHERE year=? AND month=?').get(year, month) as Record<string, unknown> | undefined
    return row ? rowToPeriod(row) : null
  }

  findCurrent(): Period | null {
    const now = dayjs()
    return this.findByYearMonth(now.year(), now.month() + 1)
  }

  findOpen(): Period[] {
    const db = getDb()
    return (db.prepare("SELECT * FROM periods WHERE status='open' ORDER BY year,month").all() as Record<string, unknown>[]).map(rowToPeriod)
  }

  create(period: Period): void {
    const db = getDb()
    const now = dayjs().toISOString()
    db.prepare(`
      INSERT INTO periods (id,year,month,name,start_date,end_date,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(period.id, period.year, period.month, period.name,
           period.startDate, period.endDate, period.status, now, now)
  }

  updateStatus(id: string, status: Period['status'], closedBy?: string): void {
    const db = getDb()
    const now = dayjs().toISOString()
    if (status === 'closed') {
      db.prepare("UPDATE periods SET status=?,closed_at=?,closed_by=?,updated_at=? WHERE id=?")
        .run(status, now, closedBy, now, id)
    } else {
      db.prepare("UPDATE periods SET status=?,updated_at=? WHERE id=?").run(status, now, id)
    }
  }

  /** 自动生成当年剩余所有期间 */
  ensurePeriodsForYear(year: number): void {
    for (let month = 1; month <= 12; month++) {
      if (this.findByYearMonth(year, month)) continue
      const startDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      const endDate = startDate.endOf('month')
      this.create({
        id: `period_${year}_${String(month).padStart(2, '0')}`,
        year,
        month,
        name: `${year}年${String(month).padStart(2, '0')}月`,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        status: 'open',
        closedAt: null,
        closedBy: null,
        createdAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString(),
      })
    }
  }
}
