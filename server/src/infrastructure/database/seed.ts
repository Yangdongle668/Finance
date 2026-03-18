/**
 * 种子数据：初始化管理员账号
 * 运行: npm run seed
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import dayjs from 'dayjs'
import { getMasterDb } from './db'

const masterDb = getMasterDb()
const now = dayjs().toISOString()

// ── 管理员账号 ────────────────────────────────────────────
const adminExists = masterDb.prepare('SELECT id FROM users LIMIT 1').get()
if (!adminExists) {
  const adminPwd = bcrypt.hashSync('Admin@123', 10)
  masterDb.prepare(`
    INSERT INTO users (id,username,password,name,role,is_enabled,created_at,updated_at)
    VALUES (?,?,?,?,?,1,?,?)
  `).run(uuid(), 'admin', adminPwd, '系统管理员', 'admin', now, now)
  console.log('✅ 管理员账号创建成功: admin / Admin@123')
} else {
  console.log('✅ 管理员账号已存在')
}

console.log('✅ 种子数据初始化完成')
console.log('   管理员账号: admin / Admin@123')
console.log('   请在前端创建账套后开始使用')
process.exit(0)
