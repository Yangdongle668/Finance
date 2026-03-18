-- ============================================================
-- 乐算云系统 - 主数据库 Schema (master.db)
-- 存储用户、公司(账套)、用户-公司权限映射
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── 用户表 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,          -- bcrypt hash
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  avatar      TEXT,
  is_enabled  INTEGER NOT NULL DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ── 公司(账套)表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  tax_no              TEXT,
  legal_person        TEXT,
  industry            TEXT,
  address             TEXT,
  phone               TEXT,
  fiscal_year_start   INTEGER NOT NULL DEFAULT 1,
  accounting_standard TEXT NOT NULL DEFAULT 'small',
  currency            TEXT NOT NULL DEFAULT 'CNY',
  status              TEXT NOT NULL DEFAULT 'active',  -- active | archived
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- ── 用户-公司映射(含角色/权限) ────────────────────────────
CREATE TABLE IF NOT EXISTS user_companies (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'accountant',
  -- admin | supervisor | accountant | cashier | viewer
  permissions TEXT,  -- JSON array of permission overrides, null = use role defaults
  created_at  TEXT NOT NULL,
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_uc_user    ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_uc_company ON user_companies(company_id);
