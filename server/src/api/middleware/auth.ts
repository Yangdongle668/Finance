import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getMasterDb, runWithCompanyDb } from '../../infrastructure/database/db'
import { runCompanyMigrations } from '../../infrastructure/database/migrate'

export interface JwtPayload {
  userId: string
  username: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      companyId?: string
      companyRole?: string
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未登录或令牌已过期' })
    return
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ code: 401, message: '令牌无效' })
  }
}

/**
 * Company context middleware — reads X-Company-Id header,
 * validates user access, and sets up AsyncLocalStorage context.
 * Must be applied AFTER authenticate.
 */
export function companyContext(req: Request, res: Response, next: NextFunction): void {
  const companyId = req.headers['x-company-id'] as string
  if (!companyId) {
    res.status(400).json({ code: 400, message: '缺少 X-Company-Id 请求头' })
    return
  }

  // Verify user has access to this company
  const db = getMasterDb()
  const uc = db.prepare('SELECT role, permissions FROM user_companies WHERE user_id=? AND company_id=?')
    .get(req.user!.userId, companyId) as { role: string; permissions: string | null } | undefined

  if (!uc) {
    res.status(403).json({ code: 403, message: '无权访问此账套' })
    return
  }

  req.companyId = companyId
  req.companyRole = uc.role

  // Ensure company DB is migrated, then run handler within company context
  runCompanyMigrations(companyId)
  runWithCompanyDb(companyId, () => {
    next()
  })
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.companyRole || req.user?.role
    if (!role || !roles.includes(role)) {
      res.status(403).json({ code: 403, message: '权限不足' })
      return
    }
    next()
  }
}

/**
 * Permission check middleware.
 * Checks if user's role or explicit permissions grant access.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  supervisor: [
    'voucher:view', 'voucher:create', 'voucher:edit', 'voucher:delete', 'voucher:review', 'voucher:post',
    'account:view', 'account:create', 'account:edit',
    'report:view', 'report:export',
    'period:view', 'period:close', 'period:reopen',
    'asset:view', 'asset:create', 'asset:edit', 'asset:depreciate',
    'invoice:view', 'invoice:create', 'invoice:edit',
    'closing:view', 'closing:execute',
    'attachment:view', 'attachment:upload',
    'user:view',
  ],
  accountant: [
    'voucher:view', 'voucher:create', 'voucher:edit',
    'account:view',
    'report:view',
    'period:view',
    'asset:view', 'asset:create', 'asset:edit', 'asset:depreciate',
    'invoice:view', 'invoice:create', 'invoice:edit',
    'closing:view', 'closing:execute',
    'attachment:view', 'attachment:upload',
  ],
  cashier: [
    'voucher:view', 'voucher:create',
    'account:view',
    'report:view',
    'period:view',
    'invoice:view',
    'attachment:view', 'attachment:upload',
  ],
  viewer: [
    'voucher:view',
    'account:view',
    'report:view',
    'period:view',
    'asset:view',
    'invoice:view',
    'closing:view',
    'attachment:view',
  ],
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.companyRole || 'viewer'
    const rolePerms = ROLE_PERMISSIONS[role] || []

    // Admin has all permissions
    if (rolePerms.includes('*')) { next(); return }

    // Check explicit user permissions override
    if (req.companyId) {
      const db = getMasterDb()
      const uc = db.prepare('SELECT permissions FROM user_companies WHERE user_id=? AND company_id=?')
        .get(req.user!.userId, req.companyId) as { permissions: string | null } | undefined
      if (uc?.permissions) {
        const userPerms: string[] = JSON.parse(uc.permissions)
        const hasAll = permissions.every(p => userPerms.includes(p))
        if (hasAll) { next(); return }
      }
    }

    // Check role-based permissions
    const hasAll = permissions.every(p => rolePerms.includes(p))
    if (!hasAll) {
      res.status(403).json({ code: 403, message: '权限不足' })
      return
    }
    next()
  }
}
