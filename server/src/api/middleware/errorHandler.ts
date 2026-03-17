import { Request, Response, NextFunction } from 'express'
import { logger } from '../../infrastructure/logger'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.statusCode, message: err.message })
    return
  }

  logger.error(err)
  res.status(500).json({ code: 500, message: '服务器内部错误', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined })
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ code: 404, message: '接口不存在' })
}

/** 统一成功响应 */
export function ok<T>(res: Response, data: T, message = 'success'): void {
  res.json({ code: 0, message, data })
}

export function paginate<T>(res: Response, data: T[], total: number, page: number, pageSize: number): void {
  res.json({ code: 0, message: 'success', data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
