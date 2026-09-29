import fs from 'fs'
import path from 'path'
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

const INLINE_COMPANY_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT, ip TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS periods (id TEXT PRIMARY KEY, year INTEGER NOT NULL, month INTEGER NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', closed_at TEXT, closed_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(year, month));
CREATE TABLE IF NOT EXISTS accounts (code TEXT PRIMARY KEY, name TEXT NOT NULL, level INTEGER NOT NULL, nature TEXT NOT NULL, direction TEXT NOT NULL, parent_code TEXT REFERENCES accounts(code), is_leaf INTEGER NOT NULL DEFAULT 1, is_enabled INTEGER NOT NULL DEFAULT 1, has_cost_center INTEGER NOT NULL DEFAULT 0, has_project INTEGER NOT NULL DEFAULT 0, has_customer INTEGER NOT NULL DEFAULT 0, has_supplier INTEGER NOT NULL DEFAULT 0, remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_code);
CREATE INDEX IF NOT EXISTS idx_accounts_nature ON accounts(nature);
CREATE TABLE IF NOT EXISTS dimensions (id TEXT PRIMARY KEY, type TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, parent_id TEXT REFERENCES dimensions(id), is_enabled INTEGER NOT NULL DEFAULT 1, remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(type, code));
CREATE TABLE IF NOT EXISTS vouchers (id TEXT PRIMARY KEY, voucher_no TEXT NOT NULL, voucher_word TEXT NOT NULL DEFAULT '记', voucher_date TEXT NOT NULL, period_id TEXT NOT NULL REFERENCES periods(id), summary TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'draft', attachment_count INTEGER NOT NULL DEFAULT 0, attachment_desc TEXT, prepared_by TEXT NOT NULL, reviewed_by TEXT, posted_by TEXT, reversed_by TEXT, reverse_voucher_id TEXT REFERENCES vouchers(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_vouchers_period ON vouchers(period_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_no ON vouchers(voucher_no);
CREATE TABLE IF NOT EXISTS voucher_lines (id TEXT PRIMARY KEY, voucher_id TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE, line_no INTEGER NOT NULL, account_code TEXT NOT NULL REFERENCES accounts(code), account_name TEXT NOT NULL, direction TEXT NOT NULL, amount INTEGER NOT NULL, department_id TEXT REFERENCES dimensions(id), project_id TEXT REFERENCES dimensions(id), customer_id TEXT REFERENCES dimensions(id), supplier_id TEXT REFERENCES dimensions(id), remark TEXT, UNIQUE(voucher_id, line_no));
CREATE INDEX IF NOT EXISTS idx_vlines_voucher ON voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS idx_vlines_account ON voucher_lines(account_code);
CREATE TABLE IF NOT EXISTS account_balances (id TEXT PRIMARY KEY, account_code TEXT NOT NULL REFERENCES accounts(code), period_id TEXT NOT NULL REFERENCES periods(id), opening_debit INTEGER NOT NULL DEFAULT 0, opening_credit INTEGER NOT NULL DEFAULT 0, debit_amount INTEGER NOT NULL DEFAULT 0, credit_amount INTEGER NOT NULL DEFAULT 0, closing_debit INTEGER NOT NULL DEFAULT 0, closing_credit INTEGER NOT NULL DEFAULT 0, UNIQUE(account_code, period_id));
CREATE INDEX IF NOT EXISTS idx_balances_period ON account_balances(period_id);
CREATE INDEX IF NOT EXISTS idx_balances_account ON account_balances(account_code);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, asset_no TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, original_value INTEGER NOT NULL, salvage_rate REAL NOT NULL DEFAULT 0.05, useful_life INTEGER NOT NULL, depreciation_method TEXT NOT NULL DEFAULT 'straight_line', acquired_date TEXT NOT NULL, start_deprec_date TEXT NOT NULL, department_id TEXT REFERENCES dimensions(id), location TEXT, account_code TEXT NOT NULL, depr_account_code TEXT NOT NULL, expense_account_code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', barcode TEXT, remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS asset_depreciations (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id), period_id TEXT NOT NULL REFERENCES periods(id), depreciation_amount INTEGER NOT NULL, accumulated_depreciation INTEGER NOT NULL, net_value INTEGER NOT NULL, voucher_id TEXT REFERENCES vouchers(id), created_at TEXT NOT NULL, UNIQUE(asset_id, period_id));
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, direction TEXT NOT NULL, invoice_type TEXT NOT NULL, invoice_no TEXT NOT NULL, invoice_code TEXT, invoice_date TEXT NOT NULL, seller_name TEXT NOT NULL, seller_tax_no TEXT, buyer_name TEXT NOT NULL, buyer_tax_no TEXT, amount_ex_tax INTEGER NOT NULL, tax_rate REAL NOT NULL, tax_amount INTEGER NOT NULL, total_amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', voucher_id TEXT REFERENCES vouchers(id), certified_date TEXT, remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_invoices_direction ON invoices(direction);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE TABLE IF NOT EXISTS bank_accounts (id TEXT PRIMARY KEY, account_name TEXT NOT NULL, bank_name TEXT NOT NULL, account_no TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', opening_balance INTEGER NOT NULL DEFAULT 0, account_code TEXT NOT NULL REFERENCES accounts(code), is_active INTEGER NOT NULL DEFAULT 1, remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bank_statements (id TEXT PRIMARY KEY, bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id), transaction_date TEXT NOT NULL, description TEXT NOT NULL, debit_amount INTEGER NOT NULL DEFAULT 0, credit_amount INTEGER NOT NULL DEFAULT 0, balance INTEGER NOT NULL, is_reconciled INTEGER NOT NULL DEFAULT 0, voucher_line_id TEXT REFERENCES voucher_lines(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, employee_no TEXT NOT NULL UNIQUE, name TEXT NOT NULL, id_card TEXT, join_date TEXT NOT NULL, department_id TEXT REFERENCES dimensions(id), base_salary INTEGER NOT NULL DEFAULT 0, salary_type TEXT NOT NULL DEFAULT 'monthly', status TEXT NOT NULL DEFAULT 'active', remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payrolls (id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES periods(id), status TEXT NOT NULL DEFAULT 'draft', total_gross INTEGER NOT NULL DEFAULT 0, total_deductions INTEGER NOT NULL DEFAULT 0, total_net INTEGER NOT NULL DEFAULT 0, voucher_id TEXT REFERENCES vouchers(id), confirmed_by TEXT, confirmed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payroll_items (id TEXT PRIMARY KEY, payroll_id TEXT NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE, employee_id TEXT NOT NULL REFERENCES employees(id), employee_name TEXT NOT NULL, base_salary INTEGER NOT NULL DEFAULT 0, performance_bonus INTEGER NOT NULL DEFAULT 0, allowances INTEGER NOT NULL DEFAULT 0, social_insurance INTEGER NOT NULL DEFAULT 0, housing_fund INTEGER NOT NULL DEFAULT 0, income_tax INTEGER NOT NULL DEFAULT 0, other_deductions INTEGER NOT NULL DEFAULT 0, net_salary INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS attachment_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, name TEXT NOT NULL, remark TEXT, category_id TEXT REFERENCES attachment_categories(id), amount INTEGER NOT NULL DEFAULT 0, period_id TEXT REFERENCES periods(id), voucher_id TEXT REFERENCES vouchers(id), upload_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_attachments_category ON attachments(category_id);
CREATE INDEX IF NOT EXISTS idx_attachments_period ON attachments(period_id);
CREATE INDEX IF NOT EXISTS idx_attachments_voucher ON attachments(voucher_id);
CREATE TABLE IF NOT EXISTS closing_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'custom', system_key TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, is_system INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 99, voucher_word TEXT NOT NULL DEFAULT '记', summary TEXT, config TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS closing_template_lines (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES closing_templates(id) ON DELETE CASCADE, line_no INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT '', account_code TEXT NOT NULL, account_name TEXT NOT NULL, direction TEXT NOT NULL, amount_type TEXT NOT NULL DEFAULT 'balance_out', ratio REAL NOT NULL DEFAULT 1.0, UNIQUE(template_id, line_no));
CREATE TABLE IF NOT EXISTS closing_vouchers (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES closing_templates(id), period_id TEXT NOT NULL REFERENCES periods(id), voucher_id TEXT NOT NULL REFERENCES vouchers(id), created_at TEXT NOT NULL, UNIQUE(template_id, period_id));
`

/** Run company database schema for a specific company */
export function runCompanyMigrations(companyId: string): void {
  const db = getCompanyDb(companyId)
  const schemaPath = path.join(__dirname, 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    db.exec(fs.readFileSync(schemaPath, 'utf-8'))
  } else {
    db.exec(INLINE_COMPANY_SCHEMA)
  }

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
