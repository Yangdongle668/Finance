import fs from 'fs'
import path from 'path'
import { getMasterDb, getCompanyDb } from './db'
import { logger } from '../logger'

export function runMigrations(): void {
  // Master DB is self-initializing in getMasterDb()
  getMasterDb()
  logger.info('Master database ready')
}

export function runCompanyMigrations(companyId: string): void {
  const db = getCompanyDb(companyId)
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(sql)
  logger.info(`Company ${companyId} database migrations completed`)
}

if (require.main === module) {
  runMigrations()
  process.exit(0)
}
