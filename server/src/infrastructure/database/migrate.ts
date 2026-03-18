import fs from 'fs'
import path from 'path'
import { getDb } from './db'
import { logger } from '../logger'

export function runMigrations(): void {
  const db = getDb()
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf-8')

  // Execute all statements in the schema
  db.exec(sql)

  // Incremental migrations for existing tables
  const columns = db.prepare("PRAGMA table_info(vouchers)").all() as { name: string }[]
  const colNames = columns.map(c => c.name)
  if (!colNames.includes('voucher_word')) {
    db.exec("ALTER TABLE vouchers ADD COLUMN voucher_word TEXT NOT NULL DEFAULT '记'")
    logger.info('Migration: added voucher_word column to vouchers')
  }

  logger.info('Database migrations completed')
}

if (require.main === module) {
  runMigrations()
  process.exit(0)
}
