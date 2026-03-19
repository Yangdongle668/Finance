import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'
import { getMasterDb, getCompanyDb } from './db'
import { logger } from '../logger'

/** Run master database schema */
export function runMasterMigrations(): void {
  const db = getMasterDb()
  const schemaPath = path.join(__dirname, 'master-schema.sql')
  if (fs.existsSync(schemaPath)) {
    db.exec(fs.readFileSync(schemaPath, 'utf-8'))
  } else {
    // Fallback: create tables inline if schema file not found in dist
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
        name TEXT NOT NULL, email TEXT, phone TEXT, avatar TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1, last_login TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, tax_no TEXT, legal_person TEXT,
        industry TEXT, address TEXT, phone TEXT,
        fiscal_year_start INTEGER NOT NULL DEFAULT 1,
        accounting_standard TEXT NOT NULL DEFAULT 'small',
        currency TEXT NOT NULL DEFAULT 'CNY',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_companies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'accountant',
        permissions TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, company_id)
      );
      CREATE INDEX IF NOT EXISTS idx_uc_user ON user_companies(user_id);
      CREATE INDEX IF NOT EXISTS idx_uc_company ON user_companies(company_id);
    `)
  }
  logger.info('Master database migrations completed')
}

/** Run company database schema for a specific company */
export function runCompanyMigrations(companyId: string): void {
  const db = getCompanyDb(companyId)
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(sql)

  // Incremental migrations
  const columns = db.prepare("PRAGMA table_info(vouchers)").all() as { name: string }[]
  const colNames = columns.map(c => c.name)
  if (!colNames.includes('voucher_word')) {
    db.exec("ALTER TABLE vouchers ADD COLUMN voucher_word TEXT NOT NULL DEFAULT '记'")
    logger.info(`Migration [${companyId}]: added voucher_word column to vouchers`)
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
    const uuid = () => require('crypto').randomUUID()
    insertTpl.run('sys_depreciation','计提折旧','system','depreciation',10,'记','计提折旧费用',null,now,now)
    insertTpl.run('sys_cost_of_sales','结转销售成本','system','cost_of_sales',20,'记','结转销售成本',null,now,now)
    insertTpl.run('sys_vat_out','转出未交增值税','system','vat_out',60,'记','转出未交增值税',null,now,now)
    insertTpl.run('sys_surcharge_tax','计提附加税','system','surcharge_tax',70,'记','计提附加税',null,now,now)
    insertTpl.run('sys_income_tax','计提所得税','system','income_tax',80,'记','计提所得税',null,now,now)
    insertTpl.run('sys_pnl','结转损益','system','pnl',90,'记','结转本期损益',null,now,now)
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
    logger.info(`Migration [${companyId}]: seeded system closing templates`)
  }

  // Seed default chart of accounts if empty (小企业会计准则)
  const acctCount = (db.prepare('SELECT COUNT(*) as c FROM accounts').get() as { c: number }).c
  if (acctCount === 0) {
    const now = new Date().toISOString()
    const insertAcct = db.prepare(`
      INSERT OR IGNORE INTO accounts (code,name,level,nature,direction,parent_code,is_leaf,is_enabled,
        has_cost_center,has_project,has_customer,has_supplier,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,1,0,0,0,0,?,?)
    `)
    const accounts: [string, string, number, string, string, string | null, number][] = [
      ['1001','库存现金',1,'asset','debit',null,1],
      ['1002','银行存款',1,'asset','debit',null,0],
      ['100201','工商银行-基本账户',2,'asset','debit','1002',1],
      ['100202','招商银行-一般账户',2,'asset','debit','1002',1],
      ['1121','应收票据',1,'asset','debit',null,1],
      ['1122','应收账款',1,'asset','debit',null,1],
      ['1123','预付账款',1,'asset','debit',null,1],
      ['1231','其他应收款',1,'asset','debit',null,1],
      ['1401','材料采购',1,'asset','debit',null,1],
      ['1402','在途物资',1,'asset','debit',null,1],
      ['1403','原材料',1,'asset','debit',null,1],
      ['1405','库存商品',1,'asset','debit',null,1],
      ['1601','固定资产',1,'asset','debit',null,1],
      ['1602','累计折旧',1,'asset','credit',null,1],
      ['1701','无形资产',1,'asset','debit',null,1],
      ['1901','待处理财产损溢',1,'asset','debit',null,1],
      ['2001','短期借款',1,'liability','credit',null,1],
      ['2202','应付账款',1,'liability','credit',null,1],
      ['2203','预收账款',1,'liability','credit',null,1],
      ['2211','应付职工薪酬',1,'liability','credit',null,0],
      ['221101','应付工资',2,'liability','credit','2211',1],
      ['221102','应付社会保险费',2,'liability','credit','2211',1],
      ['221103','应付住房公积金',2,'liability','credit','2211',1],
      ['2221','应交税费',1,'liability','credit',null,0],
      ['222101','应交增值税',2,'liability','credit','2221',1],
      ['222102','应交企业所得税',2,'liability','credit','2221',1],
      ['222103','应交城市维护建设税',2,'liability','credit','2221',1],
      ['222104','应交教育费附加',2,'liability','credit','2221',1],
      ['222105','应交地方教育附加',2,'liability','credit','2221',1],
      ['2241','其他应付款',1,'liability','credit',null,1],
      ['2501','长期借款',1,'liability','credit',null,1],
      ['2701','长期应付款',1,'liability','credit',null,1],
      ['4001','实收资本',1,'equity','credit',null,1],
      ['4101','盈余公积',1,'equity','credit',null,1],
      ['4102','本年利润',1,'equity','credit',null,1],
      ['4103','利润分配',1,'equity','credit',null,1],
      ['6001','主营业务收入',1,'income','credit',null,1],
      ['6051','其他业务收入',1,'income','credit',null,1],
      ['6301','营业外收入',1,'income','credit',null,1],
      ['6401','主营业务成本',1,'expense','debit',null,1],
      ['6402','其他业务成本',1,'expense','debit',null,1],
      ['6601','销售费用',1,'expense','debit',null,0],
      ['660101','销售人员工资',2,'expense','debit','6601',1],
      ['660102','广告费',2,'expense','debit','6601',1],
      ['660103','运输费',2,'expense','debit','6601',1],
      ['6602','管理费用',1,'expense','debit',null,0],
      ['660201','管理人员工资',2,'expense','debit','6602',1],
      ['660202','折旧费',2,'expense','debit','6602',1],
      ['660203','办公费',2,'expense','debit','6602',1],
      ['660204','差旅费',2,'expense','debit','6602',1],
      ['6603','财务费用',1,'expense','debit',null,0],
      ['660301','利息支出',2,'expense','debit','6603',1],
      ['660302','手续费',2,'expense','debit','6603',1],
      ['5402','税金及附加',1,'expense','debit',null,1],
      ['6604','研发费用',1,'expense','debit',null,1],
      ['6711','营业外支出',1,'expense','debit',null,1],
      ['6801','所得税费用',1,'expense','debit',null,1],
    ]
    const parentCodes = new Set(accounts.filter(a => a[5]).map(a => a[5]))
    for (const a of accounts) {
      const isLeaf = !parentCodes.has(a[0]) ? 1 : 0
      insertAcct.run(a[0], a[1], a[2], a[3], a[4], a[5] || null, isLeaf, now, now)
    }
    logger.info(`Migration [${companyId}]: seeded default chart of accounts`)
  }

  // Seed periods for current year if empty
  const periodCount = (db.prepare('SELECT COUNT(*) as c FROM periods').get() as { c: number }).c
  if (periodCount === 0) {
    const now = new Date().toISOString()
    const year = dayjs().year()
    const insertPeriod = db.prepare(`
      INSERT OR IGNORE INTO periods (id,year,month,name,start_date,end_date,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    for (let month = 1; month <= 12; month++) {
      const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      const end = start.endOf('month')
      insertPeriod.run(
        `period_${year}_${String(month).padStart(2, '0')}`,
        year, month,
        `${year}年${String(month).padStart(2, '0')}月`,
        start.format('YYYY-MM-DD'),
        end.format('YYYY-MM-DD'),
        'open', now, now
      )
    }
    logger.info(`Migration [${companyId}]: seeded ${year} periods`)
  }

  logger.info(`Company database migrations completed for: ${companyId}`)
}

/** Run all migrations — called on server startup */
export function runMigrations(): void {
  // 1. Master DB
  runMasterMigrations()

  // 2. Find and migrate all existing company databases
  const masterDb = getMasterDb()
  const companies = masterDb.prepare('SELECT id FROM companies').all() as { id: string }[]
  for (const c of companies) {
    runCompanyMigrations(c.id)
  }

  logger.info('All database migrations completed')
}

if (require.main === module) {
  runMigrations()
  process.exit(0)
}
