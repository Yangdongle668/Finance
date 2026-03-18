import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { companyContext } from '../../infrastructure/database/db'

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

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ code: 403, message: '权限不足' })
      return
    }
    next()
  }
}

/**
 * Middleware to extract company context from x-company-id header
 * and set it for the request lifecycle using AsyncLocalStorage.
 */
export function companyScope(req: Request, res: Response, next: NextFunction): void {
  const companyId = req.headers['x-company-id'] as string
  if (!companyId) {
    res.status(400).json({ code: 400, message: '缺少账套ID (x-company-id header)' })
    return
  }
  req.companyId = companyId
  companyContext.run(companyId, () => next())
}
