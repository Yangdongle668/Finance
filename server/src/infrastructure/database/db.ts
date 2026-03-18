import Database from 'better-sqlite3'
import { AsyncLocalStorage } from 'async_hooks'
import path from 'path'
import fs from 'fs'
import { logger } from '../logger'

const DATA_DIR = path.dirname(process.env.DB_PATH || path.join(process.cwd(), 'data', 'finance.db'))

// ── Master database (users, companies) ────────────────────

let _masterDb: Database.Database | null = null

export function getMasterDb(): Database.Database {
  if (!_masterDb) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    const dbPath = path.join(DATA_DIR, 'master.db')
    _masterDb = new Database(dbPath)
    _masterDb.pragma('journal_mode = WAL')
    _masterDb.pragma('foreign_keys = ON')
    logger.info(`Master database connected: ${dbPath}`)
  }
  return _masterDb
}

// ── Company databases (accounting data) ───────────────────

const _companyDbs = new Map<string, Database.Database>()
const _companyAls = new AsyncLocalStorage<Database.Database>()

export function getCompanyDb(companyId: string): Database.Database {
  if (!_companyDbs.has(companyId)) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    const dbPath = path.join(DATA_DIR, `company_${companyId}.db`)
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    _companyDbs.set(companyId, db)
    logger.info(`Company database connected: ${dbPath}`)
  }
  return _companyDbs.get(companyId)!
}

/**
 * Run a callback with the company database set as the current context.
 * All calls to getDb() within the callback (and its async continuations) will
 * return this company's database.
 */
export function runWithCompanyDb<T>(companyId: string, fn: () => T): T {
  const db = getCompanyDb(companyId)
  return _companyAls.run(db, fn)
}

/**
 * Get the current company database from AsyncLocalStorage context.
 * This is the primary method used by all services/repositories.
 * Must be called within a runWithCompanyDb() context.
 */
export function getDb(): Database.Database {
  const db = _companyAls.getStore()
  if (!db) throw new Error('No company database context — ensure X-Company-Id header is set')
  return db
}

// ── Utilities ─────────────────────────────────────────────

export function closeDb(): void {
  if (_masterDb) { _masterDb.close(); _masterDb = null }
  for (const [id, db] of _companyDbs) { db.close() }
  _companyDbs.clear()
}

/** 在当前公司DB的事务中执行，失败自动回滚 */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDb()
  const txn = db.transaction(fn)
  return txn(db)
}

/** Get the data directory path */
export function getDataDir(): string {
  return DATA_DIR
}
