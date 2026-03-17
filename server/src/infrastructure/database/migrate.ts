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
  logger.info('Database migrations completed')
}

if (require.main === module) {
  runMigrations()
  process.exit(0)
}
