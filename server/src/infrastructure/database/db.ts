import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { logger } from '../logger'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'finance.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    logger.info(`Database connected: ${DB_PATH}`)
  }
  return _db
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

/** 在事务中执行，失败自动回滚 */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDb()
  const txn = db.transaction(fn)
  return txn(db)
}
