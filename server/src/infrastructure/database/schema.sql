-- ============================================================
-- 精斗云云会计系统 - 数据库 Schema
-- SQLite，所有金额以"分"为单位存储，避免浮点精度问题
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── 用户与权限 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,          -- bcrypt hash
  name        TEXT NOT NULL,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'accountant',
  -- admin | supervisor | accountant | cashier | viewer
  is_enabled  INTEGER NOT NULL DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL,          -- create | update | delete | approve | post
  entity_type TEXT NOT NULL,          -- voucher | account | ...
  entity_id   TEXT NOT NULL,
  detail      TEXT,                   -- JSON
  ip          TEXT,
  created_at  TEXT NOT NULL
);

-- ── 企业信息 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company (
  id           TEXT PRIMARY KEY DEFAULT 'default',
  name         TEXT NOT NULL,
  tax_no       TEXT,
  legal_person TEXT,
  industry     TEXT,
  address      TEXT,
  phone        TEXT,
  fiscal_year_start INTEGER NOT NULL DEFAULT 1,  -- 财年起始月
  accounting_standard TEXT NOT NULL DEFAULT 'small',  -- small | general
  currency     TEXT NOT NULL DEFAULT 'CNY',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- ── 会计期间 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS periods (
  id          TEXT PRIMARY KEY,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,        -- 1-12
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',  -- open | closing | closed
  closed_at   TEXT,
  closed_by   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(year, month)
);

-- ── 科目表 ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  code              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  level             INTEGER NOT NULL,   -- 1-4
  nature            TEXT NOT NULL,      -- asset|liability|equity|income|expense
  direction         TEXT NOT NULL,      -- debit|credit
  parent_code       TEXT REFERENCES accounts(code),
  is_leaf           INTEGER NOT NULL DEFAULT 1,
  is_enabled        INTEGER NOT NULL DEFAULT 1,
  has_cost_center   INTEGER NOT NULL DEFAULT 0,
  has_project       INTEGER NOT NULL DEFAULT 0,
  has_customer      INTEGER NOT NULL DEFAULT 0,
  has_supplier      INTEGER NOT NULL DEFAULT 0,
  remark            TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_code);
CREATE INDEX IF NOT EXISTS idx_accounts_nature ON accounts(nature);

-- ── 核算项目（部门/项目/客户/供应商/自定义） ────────────────

CREATE TABLE IF NOT EXISTS dimensions (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,    -- department|project|customer|supplier|custom
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  parent_id   TEXT REFERENCES dimensions(id),
  is_enabled  INTEGER NOT NULL DEFAULT 1,
  remark      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(type, code)
);

-- ── 凭证 ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vouchers (
  id                TEXT PRIMARY KEY,
  voucher_no        TEXT NOT NULL,
  voucher_word      TEXT NOT NULL DEFAULT '记',  -- 凭证字：记|收|付|转
  voucher_date      TEXT NOT NULL,
  period_id         TEXT NOT NULL REFERENCES periods(id),
  summary           TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'manual',
  -- manual|system|carry_forward|depreciation|payroll|tax
  status            TEXT NOT NULL DEFAULT 'draft',
  -- draft|pending|approved|posted|reversed
  attachment_count  INTEGER NOT NULL DEFAULT 0,
  attachment_desc   TEXT,
  prepared_by       TEXT NOT NULL REFERENCES users(id),
  reviewed_by       TEXT REFERENCES users(id),
  posted_by         TEXT REFERENCES users(id),
  reversed_by       TEXT REFERENCES users(id),
  reverse_voucher_id TEXT REFERENCES vouchers(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vouchers_period   ON vouchers(period_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_date     ON vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_status   ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_no       ON vouchers(voucher_no);

CREATE TABLE IF NOT EXISTS voucher_lines (
  id            TEXT PRIMARY KEY,
  voucher_id    TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  line_no       INTEGER NOT NULL,
  account_code  TEXT NOT NULL REFERENCES accounts(code),
  account_name  TEXT NOT NULL,
  direction     TEXT NOT NULL,    -- debit|credit
  amount        INTEGER NOT NULL, -- 分
  department_id TEXT REFERENCES dimensions(id),
  project_id    TEXT REFERENCES dimensions(id),
  customer_id   TEXT REFERENCES dimensions(id),
  supplier_id   TEXT REFERENCES dimensions(id),
  remark        TEXT,
  UNIQUE(voucher_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_vlines_voucher  ON voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS idx_vlines_account  ON voucher_lines(account_code);

-- ── 科目余额表 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_balances (
  id              TEXT PRIMARY KEY,
  account_code    TEXT NOT NULL REFERENCES accounts(code),
  period_id       TEXT NOT NULL REFERENCES periods(id),
  opening_debit   INTEGER NOT NULL DEFAULT 0,   -- 期初借方余额（分）
  opening_credit  INTEGER NOT NULL DEFAULT 0,   -- 期初贷方余额（分）
  debit_amount    INTEGER NOT NULL DEFAULT 0,   -- 本期借方发生额（分）
  credit_amount   INTEGER NOT NULL DEFAULT 0,   -- 本期贷方发生额（分）
  closing_debit   INTEGER NOT NULL DEFAULT 0,   -- 期末借方余额（分）
  closing_credit  INTEGER NOT NULL DEFAULT 0,   -- 期末贷方余额（分）
  UNIQUE(account_code, period_id)
);

CREATE INDEX IF NOT EXISTS idx_balances_period  ON account_balances(period_id);
CREATE INDEX IF NOT EXISTS idx_balances_account ON account_balances(account_code);

-- ── 固定资产 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id                    TEXT PRIMARY KEY,
  asset_no              TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  original_value        INTEGER NOT NULL,  -- 分
  salvage_rate          REAL NOT NULL DEFAULT 0.05,
  useful_life           INTEGER NOT NULL,  -- 月
  depreciation_method   TEXT NOT NULL DEFAULT 'straight_line',
  acquired_date         TEXT NOT NULL,
  start_deprec_date     TEXT NOT NULL,
  department_id         TEXT REFERENCES dimensions(id),
  location              TEXT,
  account_code          TEXT NOT NULL,
  depr_account_code     TEXT NOT NULL,
  expense_account_code  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  barcode               TEXT,
  remark                TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_depreciations (
  id                        TEXT PRIMARY KEY,
  asset_id                  TEXT NOT NULL REFERENCES assets(id),
  period_id                 TEXT NOT NULL REFERENCES periods(id),
  depreciation_amount       INTEGER NOT NULL,  -- 分
  accumulated_depreciation  INTEGER NOT NULL,  -- 分
  net_value                 INTEGER NOT NULL,  -- 分
  voucher_id                TEXT REFERENCES vouchers(id),
  created_at                TEXT NOT NULL,
  UNIQUE(asset_id, period_id)
);

-- ── 发票 ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  direction       TEXT NOT NULL,     -- input|output
  invoice_type    TEXT NOT NULL,     -- vat_special|vat_general|receipt|other
  invoice_no      TEXT NOT NULL,
  invoice_code    TEXT,
  invoice_date    TEXT NOT NULL,
  seller_name     TEXT NOT NULL,
  seller_tax_no   TEXT,
  buyer_name      TEXT NOT NULL,
  buyer_tax_no    TEXT,
  amount_ex_tax   INTEGER NOT NULL,  -- 不含税金额（分）
  tax_rate        REAL NOT NULL,     -- 税率
  tax_amount      INTEGER NOT NULL,  -- 税额（分）
  total_amount    INTEGER NOT NULL,  -- 价税合计（分）
  status          TEXT NOT NULL DEFAULT 'pending',
  voucher_id      TEXT REFERENCES vouchers(id),
  certified_date  TEXT,
  remark          TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_direction ON invoices(direction);
CREATE INDEX IF NOT EXISTS idx_invoices_date      ON invoices(invoice_date);

-- ── 银行账户 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts (
  id              TEXT PRIMARY KEY,
  account_name    TEXT NOT NULL,
  bank_name       TEXT NOT NULL,
  account_no      TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'CNY',
  opening_balance INTEGER NOT NULL DEFAULT 0,  -- 期初余额（分）
  account_code    TEXT NOT NULL REFERENCES accounts(code),
  is_active       INTEGER NOT NULL DEFAULT 1,
  remark          TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ── 银行流水 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_statements (
  id                TEXT PRIMARY KEY,
  bank_account_id   TEXT NOT NULL REFERENCES bank_accounts(id),
  transaction_date  TEXT NOT NULL,
  description       TEXT NOT NULL,
  debit_amount      INTEGER NOT NULL DEFAULT 0,   -- 支出（分）
  credit_amount     INTEGER NOT NULL DEFAULT 0,   -- 收入（分）
  balance           INTEGER NOT NULL,              -- 余额（分）
  is_reconciled     INTEGER NOT NULL DEFAULT 0,
  voucher_line_id   TEXT REFERENCES voucher_lines(id),
  created_at        TEXT NOT NULL
);

-- ── 员工与工资 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id            TEXT PRIMARY KEY,
  employee_no   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  id_card       TEXT,
  join_date     TEXT NOT NULL,
  department_id TEXT REFERENCES dimensions(id),
  base_salary   INTEGER NOT NULL DEFAULT 0,  -- 分
  salary_type   TEXT NOT NULL DEFAULT 'monthly',
  status        TEXT NOT NULL DEFAULT 'active',
  remark        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payrolls (
  id             TEXT PRIMARY KEY,
  period_id      TEXT NOT NULL REFERENCES periods(id),
  status         TEXT NOT NULL DEFAULT 'draft',
  total_gross    INTEGER NOT NULL DEFAULT 0,
  total_deductions INTEGER NOT NULL DEFAULT 0,
  total_net      INTEGER NOT NULL DEFAULT 0,
  voucher_id     TEXT REFERENCES vouchers(id),
  confirmed_by   TEXT REFERENCES users(id),
  confirmed_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id                TEXT PRIMARY KEY,
  payroll_id        TEXT NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
  employee_id       TEXT NOT NULL REFERENCES employees(id),
  employee_name     TEXT NOT NULL,
  base_salary       INTEGER NOT NULL DEFAULT 0,
  performance_bonus INTEGER NOT NULL DEFAULT 0,
  allowances        INTEGER NOT NULL DEFAULT 0,
  social_insurance  INTEGER NOT NULL DEFAULT 0,
  housing_fund      INTEGER NOT NULL DEFAULT 0,
  income_tax        INTEGER NOT NULL DEFAULT 0,
  other_deductions  INTEGER NOT NULL DEFAULT 0,
  net_salary        INTEGER NOT NULL DEFAULT 0
);

-- ── 附件分类 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attachment_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ── 原始凭证附件 ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  remark      TEXT,
  category_id TEXT REFERENCES attachment_categories(id),
  amount      INTEGER NOT NULL DEFAULT 0,  -- 金额（分）
  period_id   TEXT REFERENCES periods(id),
  voucher_id  TEXT REFERENCES vouchers(id),
  upload_date TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_category ON attachments(category_id);
CREATE INDEX IF NOT EXISTS idx_attachments_period   ON attachments(period_id);
CREATE INDEX IF NOT EXISTS idx_attachments_voucher  ON attachments(voucher_id);
