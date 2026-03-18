/**
 * 种子数据：初始化管理员账号、默认账套(公司)、标准科目表、默认期间
 * 运行: npm run seed
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import dayjs from 'dayjs'
import { getMasterDb, getCompanyDb } from './db'
import { runMasterMigrations, runCompanyMigrations } from './migrate'

// ── 1. Master DB ─────────────────────────────────────────

runMasterMigrations()
const master = getMasterDb()
const now = dayjs().toISOString()

// Admin user
const adminPwd = bcrypt.hashSync('Admin@123', 10)
const adminId = uuid()
master.prepare(`
  INSERT OR IGNORE INTO users (id,username,password,name,email,phone,is_enabled,created_at,updated_at)
  VALUES (?,?,?,?,null,null,1,?,?)
`).run(adminId, 'admin', adminPwd, '系统管理员', now, now)
const adminRow = master.prepare('SELECT id FROM users WHERE username=?').get('admin') as { id: string }
const finalAdminId = adminRow.id

// Default company (账套)
const companyId = 'default'
master.prepare(`
  INSERT OR IGNORE INTO companies (id,name,tax_no,legal_person,industry,accounting_standard,currency,status,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
`).run(companyId, '示例企业有限公司', '91110000XXXXXXXXXX', '张三', '制造业', 'small', 'CNY', 'active', now, now)

// Link admin to default company
master.prepare(`
  INSERT OR IGNORE INTO user_companies (id,user_id,company_id,role,created_at)
  VALUES (?,?,?,?,?)
`).run(uuid(), finalAdminId, companyId, 'admin', now)

// ── 2. Default Company DB ────────────────────────────────

runCompanyMigrations(companyId)
const db = getCompanyDb(companyId)

// Periods for current year
const year = dayjs().year()
for (let month = 1; month <= 12; month++) {
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const end = start.endOf('month')
  const id = `period_${year}_${String(month).padStart(2, '0')}`
  db.prepare(`
    INSERT OR IGNORE INTO periods (id,year,month,name,start_date,end_date,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, year, month, `${year}年${String(month).padStart(2, '0')}月`,
         start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), 'open', now, now)
}

// 小企业会计准则科目表
const accounts: [string, string, number, string, string, string | null, number][] = [
  ['1001', '库存现金', 1, 'asset', 'debit', null, 1],
  ['1002', '银行存款', 1, 'asset', 'debit', null, 0],
  ['100201', '工商银行-基本账户', 2, 'asset', 'debit', '1002', 1],
  ['100202', '招商银行-一般账户', 2, 'asset', 'debit', '1002', 1],
  ['1121', '应收票据', 1, 'asset', 'debit', null, 1],
  ['1122', '应收账款', 1, 'asset', 'debit', null, 1],
  ['1123', '预付账款', 1, 'asset', 'debit', null, 1],
  ['1231', '其他应收款', 1, 'asset', 'debit', null, 1],
  ['1401', '材料采购', 1, 'asset', 'debit', null, 1],
  ['1402', '在途物资', 1, 'asset', 'debit', null, 1],
  ['1403', '原材料', 1, 'asset', 'debit', null, 1],
  ['1405', '库存商品', 1, 'asset', 'debit', null, 1],
  ['1601', '固定资产', 1, 'asset', 'debit', null, 1],
  ['1602', '累计折旧', 1, 'asset', 'credit', null, 1],
  ['1701', '无形资产', 1, 'asset', 'debit', null, 1],
  ['1901', '待处理财产损溢', 1, 'asset', 'debit', null, 1],
  ['2001', '短期借款', 1, 'liability', 'credit', null, 1],
  ['2202', '应付账款', 1, 'liability', 'credit', null, 1],
  ['2203', '预收账款', 1, 'liability', 'credit', null, 1],
  ['2211', '应付职工薪酬', 1, 'liability', 'credit', null, 0],
  ['221101', '应付工资', 2, 'liability', 'credit', '2211', 1],
  ['221102', '应付社会保险费', 2, 'liability', 'credit', '2211', 1],
  ['221103', '应付住房公积金', 2, 'liability', 'credit', '2211', 1],
  ['2221', '应交税费', 1, 'liability', 'credit', null, 0],
  ['222101', '应交增值税', 2, 'liability', 'credit', '2221', 1],
  ['222102', '应交企业所得税', 2, 'liability', 'credit', '2221', 1],
  ['222103', '应交城市维护建设税', 2, 'liability', 'credit', '2221', 1],
  ['2241', '其他应付款', 1, 'liability', 'credit', null, 1],
  ['2501', '长期借款', 1, 'liability', 'credit', null, 1],
  ['2701', '长期应付款', 1, 'liability', 'credit', null, 1],
  ['4001', '实收资本', 1, 'equity', 'credit', null, 1],
  ['4101', '盈余公积', 1, 'equity', 'credit', null, 1],
  ['4102', '本年利润', 1, 'equity', 'credit', null, 1],
  ['4103', '利润分配', 1, 'equity', 'credit', null, 1],
  ['6001', '主营业务收入', 1, 'income', 'credit', null, 1],
  ['6051', '其他业务收入', 1, 'income', 'credit', null, 1],
  ['6301', '营业外收入', 1, 'income', 'credit', null, 1],
  ['6401', '主营业务成本', 1, 'expense', 'debit', null, 1],
  ['6402', '其他业务成本', 1, 'expense', 'debit', null, 1],
  ['6601', '销售费用', 1, 'expense', 'debit', null, 0],
  ['660101', '销售人员工资', 2, 'expense', 'debit', '6601', 1],
  ['660102', '广告费', 2, 'expense', 'debit', '6601', 1],
  ['660103', '运输费', 2, 'expense', 'debit', '6601', 1],
  ['6602', '管理费用', 1, 'expense', 'debit', null, 0],
  ['660201', '管理人员工资', 2, 'expense', 'debit', '6602', 1],
  ['660202', '折旧费', 2, 'expense', 'debit', '6602', 1],
  ['660203', '办公费', 2, 'expense', 'debit', '6602', 1],
  ['660204', '差旅费', 2, 'expense', 'debit', '6602', 1],
  ['6603', '财务费用', 1, 'expense', 'debit', null, 0],
  ['660301', '利息支出', 2, 'expense', 'debit', '6603', 1],
  ['660302', '手续费', 2, 'expense', 'debit', '6603', 1],
  ['6604', '研发费用', 1, 'expense', 'debit', null, 1],
  ['6711', '营业外支出', 1, 'expense', 'debit', null, 1],
  ['6801', '所得税费用', 1, 'expense', 'debit', null, 1],
]

const insertAccount = db.prepare(`
  INSERT OR IGNORE INTO accounts
    (code,name,level,nature,direction,parent_code,is_leaf,is_enabled,
     has_cost_center,has_project,has_customer,has_supplier,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,1, 0,0,0,0,?,?)
`)
const parentCodes = new Set(accounts.filter(a => a[5]).map(a => a[5]))
for (const a of accounts) {
  const isLeaf = !parentCodes.has(a[0]) ? 1 : 0
  insertAccount.run(a[0], a[1], a[2], a[3], a[4], a[5] || null, isLeaf, now, now)
}

const dims: [string, string, string, string][] = [
  [uuid(), 'department', 'D001', '财务部'],
  [uuid(), 'department', 'D002', '销售部'],
  [uuid(), 'department', 'D003', '生产部'],
  [uuid(), 'department', 'D004', '行政部'],
]
const insertDim = db.prepare(`
  INSERT OR IGNORE INTO dimensions (id,type,code,name,is_enabled,created_at,updated_at)
  VALUES (?,?,?,?,1,?,?)
`)
for (const d of dims) insertDim.run(...d, now, now)

console.log('✅ 乐算云系统种子数据初始化完成')
console.log('   管理员账号: admin / Admin@123')
console.log('   默认账套: 示例企业有限公司')
process.exit(0)
