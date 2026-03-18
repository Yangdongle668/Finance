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

  // Seed system closing templates if not exist
  const tplCount = (db.prepare('SELECT COUNT(*) as c FROM closing_templates WHERE is_system=1').get() as { c: number }).c
  if (tplCount === 0) {
    const now = new Date().toISOString()
    const insertTpl = db.prepare(`
      INSERT OR IGNORE INTO closing_templates (id,name,type,system_key,is_enabled,is_system,sort_order,voucher_word,summary,config,created_at,updated_at)
      VALUES (?,?,?,?,1,1,?,?,?,?,?,?)
    `)
    const insertLine = db.prepare(`
      INSERT OR IGNORE INTO closing_template_lines (id,template_id,line_no,summary,account_code,account_name,direction,amount_type,ratio)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    // System templates
    insertTpl.run('sys_depreciation','计提折旧','system','depreciation',10,'记','计提折旧费用',null,now,now)
    insertTpl.run('sys_cost_of_sales','结转销售成本','system','cost_of_sales',20,'记','结转销售成本',null,now,now)
    insertTpl.run('sys_vat_out','转出未交增值税','system','vat_out',60,'记','转出未交增值税',null,now,now)
    insertTpl.run('sys_surcharge_tax','计提附加税','system','surcharge_tax',70,'记','计提附加税',null,now,now)
    insertTpl.run('sys_income_tax','计提所得税','system','income_tax',80,'记','计提所得税',null,now,now)
    insertTpl.run('sys_pnl','结转损益','system','pnl',90,'记','结转本期损益',null,now,now)
    // Default custom templates with lines
    const uuid = () => require('crypto').randomUUID()
    const rdTplId = 'tpl_rd_expense'
    db.prepare(`INSERT OR IGNORE INTO closing_templates (id,name,type,system_key,is_enabled,is_system,sort_order,voucher_word,summary,config,created_at,updated_at) VALUES (?,?,?,null,1,0,30,?,?,null,?,?)`)
      .run(rdTplId,'结转研发支出','custom','记','结转研发支出',now,now)
    insertLine.run(uuid(),rdTplId,1,'结转研发支出','6604','研发费用','credit','balance_out',1.0)
    insertLine.run(uuid(),rdTplId,2,'结转研发支出','4102','本年利润','debit','balance_in',1.0)
    const rawTplId = 'tpl_raw_material'
    db.prepare(`INSERT OR IGNORE INTO closing_templates (id,name,type,system_key,is_enabled,is_system,sort_order,voucher_word,summary,config,created_at,updated_at) VALUES (?,?,?,null,1,0,40,?,?,null,?,?)`)
      .run(rawTplId,'原材料结转','custom','记','原材料结转',now,now)
    insertLine.run(uuid(),rawTplId,1,'结转原材料','1403','原材料','credit','balance_out',1.0)
    insertLine.run(uuid(),rawTplId,2,'结转原材料','6401','主营业务成本','debit','balance_in',1.0)
    const mfgTplId = 'tpl_mfg_cost'
    db.prepare(`INSERT OR IGNORE INTO closing_templates (id,name,type,system_key,is_enabled,is_system,sort_order,voucher_word,summary,config,created_at,updated_at) VALUES (?,?,?,null,0,0,50,?,?,null,?,?)`)
      .run(mfgTplId,'结转本月制造费用','custom','记','结转制造费用',now,now)
    logger.info('Migration: seeded system closing templates')
  }

  logger.info('Database migrations completed')
}

if (require.main === module) {
  runMigrations()
  process.exit(0)
}
