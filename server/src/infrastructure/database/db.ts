import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { logger } from '../logger'
import { AsyncLocalStorage } from 'async_hooks'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')

// ── Master DB (stores companies + users) ────────────────────
let _masterDb: Database.Database | null = null

export function getMasterDb(): Database.Database {
  if (!_masterDb) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    const dbPath = path.join(DATA_DIR, 'master.db')
    _masterDb = new Database(dbPath)
    _masterDb.pragma('journal_mode = WAL')
    _masterDb.pragma('foreign_keys = ON')
    logger.info(`Master database connected: ${dbPath}`)

    // Create master schema
    _masterDb.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        username    TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        name        TEXT NOT NULL,
        email       TEXT,
        role        TEXT NOT NULL DEFAULT 'accountant',
        is_enabled  INTEGER NOT NULL DEFAULT 1,
        last_login  TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `)
  }
  return _masterDb
}

// ── Company DB pool ─────────────────────────────────────────
const _companyDbs = new Map<string, Database.Database>()

export function getCompanyDb(companyId: string): Database.Database {
  let db = _companyDbs.get(companyId)
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    const dbPath = path.join(DATA_DIR, `company_${companyId}.db`)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    _companyDbs.set(companyId, db)
    logger.info(`Company database connected: ${dbPath}`)
  }
  return db
}

// ── Request-scoped company context ──────────────────────────
export const companyContext = new AsyncLocalStorage<string>()

/**
 * getDb() - returns the company DB for the current request context.
 * Falls back to legacy single DB for backward compatibility.
 */
export function getDb(): Database.Database {
  const companyId = companyContext.getStore()
  if (companyId) {
    return getCompanyDb(companyId)
  }
  // Fallback: legacy single DB (for seed/migration scripts)
  if (!_masterDb) {
    // During seed/migration, use the old path
    const fallbackPath = process.env.DB_PATH || path.join(DATA_DIR, 'finance.db')
    const dir = path.dirname(fallbackPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const db = new Database(fallbackPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    return db
  }
  throw new Error('No company context set. Use companyContext.run() or pass companyId.')
}

export function closeDb(): void {
  if (_masterDb) { _masterDb.close(); _masterDb = null }
  for (const [, db] of _companyDbs) db.close()
  _companyDbs.clear()
}

/** Run in transaction for a specific company DB */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDb()
  const txn = db.transaction(fn)
  return txn(db)
}

/** Initialize a company database with schema */
export function initCompanyDb(companyId: string): void {
  const db = getCompanyDb(companyId)
  const schemaPath = path.join(__dirname, 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf-8')
    db.exec(sql)
  }
}
