import { v4 as uuid } from 'uuid'
import { VoucherRepository } from '../../infrastructure/repositories/VoucherRepository'
import { AccountRepository } from '../../infrastructure/repositories/AccountRepository'
import { PeriodRepository } from '../../infrastructure/repositories/PeriodRepository'
import { AppError } from '../../api/middleware/errorHandler'
import type { Voucher, VoucherLine, VoucherFilter, VoucherWord } from '../../domain/voucher/types'

export interface CreateVoucherDTO {
  voucherDate: string
  periodId: string
  summary: string
  voucherWord?: VoucherWord
  type?: Voucher['type']
  attachmentCount?: number
  attachmentDesc?: string
  preparedBy: string
  lines: {
    accountCode: string
    direction: 'debit' | 'credit'
    amount: number           // 元（前端传入），内部转换为分
    summary?: string         // 每行摘要
    departmentId?: string
    projectId?: string
    customerId?: string
    supplierId?: string
    remark?: string
  }[]
}

export interface UpdateVoucherDTO {
  voucherDate?: string
  summary?: string
  voucherWord?: VoucherWord
  attachmentCount?: number
  attachmentDesc?: string
  lines?: CreateVoucherDTO['lines']
}

export class VoucherService {
  private repo = new VoucherRepository()
  private accountRepo = new AccountRepository()
  private periodRepo = new PeriodRepository()

  list(filter: VoucherFilter) {
    return this.repo.findMany(filter)
  }

  getById(id: string) {
    return this.repo.findById(id)
  }

  create(dto: CreateVoucherDTO): Voucher {
    // 1. 验证期间
    const period = this.periodRepo.findById(dto.periodId)
    if (!period) throw new AppError(400, '期间不存在')
    if (period.status === 'closed') throw new AppError(400, '该期间已结账，无法新增凭证')

    // 2. 验证科目
    for (const line of dto.lines) {
      const account = this.accountRepo.findByCode(line.accountCode)
      if (!account) throw new AppError(400, `科目 ${line.accountCode} 不存在`)
      if (!account.isEnabled) throw new AppError(400, `科目 ${line.accountCode} 已禁用`)
      if (!account.isLeaf) throw new AppError(400, `科目 ${line.accountCode} 不是末级科目，不能直接挂凭证`)
    }

    // 3. 验证借贷平衡
    const totalDebit = dto.lines.filter(l => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
    const totalCredit = dto.lines.filter(l => l.direction === 'credit').reduce((s, l) => s + l.amount, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new AppError(400, `借贷不平衡：借方合计 ${totalDebit}，贷方合计 ${totalCredit}`)
    }

    // 4. 构建凭证
    const voucherId = uuid()
    const word = dto.voucherWord ?? '记'
    const voucherNo = this.repo.nextVoucherNo(dto.periodId, word)
    const lines: VoucherLine[] = dto.lines.map((l, i) => {
      const account = this.accountRepo.findByCode(l.accountCode)!
      return {
        id: uuid(),
        voucherId,
        lineNo: i + 1,
        accountCode: l.accountCode,
        accountName: account.name,
        direction: l.direction,
        amount: Math.round(l.amount * 100),  // 元 → 分
        departmentId: l.departmentId ?? null,
        projectId: l.projectId ?? null,
        customerId: l.customerId ?? null,
        supplierId: l.supplierId ?? null,
        remark: l.remark ?? l.summary ?? null,
      }
    })

    const voucher: Voucher = {
      id: voucherId,
      voucherNo,
      voucherWord: word,
      voucherDate: dto.voucherDate,
      periodId: dto.periodId,
      summary: dto.summary,
      type: dto.type ?? 'manual',
      status: 'draft',
      attachmentCount: dto.attachmentCount ?? 0,
      attachmentDesc: dto.attachmentDesc ?? null,
      preparedBy: dto.preparedBy,
      reviewedBy: null,
      postedBy: null,
      reversedBy: null,
      reverseVoucherId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines,
    }

    this.repo.create(voucher)
    return voucher
  }

  update(id: string, dto: UpdateVoucherDTO): Voucher {
    const v = this.assertExists(id)
    if (v.status !== 'draft') throw new AppError(400, '只有草稿凭证才能编辑')

    // Validate lines if provided
    if (dto.lines) {
      for (const line of dto.lines) {
        const account = this.accountRepo.findByCode(line.accountCode)
        if (!account) throw new AppError(400, `科目 ${line.accountCode} 不存在`)
        if (!account.isEnabled) throw new AppError(400, `科目 ${line.accountCode} 已禁用`)
        if (!account.isLeaf) throw new AppError(400, `科目 ${line.accountCode} 不是末级科目，不能直接挂凭证`)
      }

      const totalDebit = dto.lines.filter(l => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
      const totalCredit = dto.lines.filter(l => l.direction === 'credit').reduce((s, l) => s + l.amount, 0)
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new AppError(400, `借贷不平衡：借方合计 ${totalDebit}，贷方合计 ${totalCredit}`)
      }
    }

    const updated: Voucher = {
      ...v,
      voucherWord: dto.voucherWord ?? v.voucherWord,
      voucherDate: dto.voucherDate ?? v.voucherDate,
      summary: dto.summary ?? v.summary,
      attachmentCount: dto.attachmentCount ?? v.attachmentCount,
      attachmentDesc: dto.attachmentDesc ?? v.attachmentDesc,
      updatedAt: new Date().toISOString(),
    }

    if (dto.lines) {
      updated.lines = dto.lines.map((l, i) => {
        const account = this.accountRepo.findByCode(l.accountCode)!
        return {
          id: uuid(),
          voucherId: id,
          lineNo: i + 1,
          accountCode: l.accountCode,
          accountName: account.name,
          direction: l.direction,
          amount: Math.round(l.amount * 100),
          departmentId: l.departmentId ?? null,
          projectId: l.projectId ?? null,
          customerId: l.customerId ?? null,
          supplierId: l.supplierId ?? null,
          remark: l.remark ?? l.summary ?? null,
        }
      })
    }

    this.repo.update(updated)
    return updated
  }

  delete(id: string): void {
    const v = this.assertExists(id)
    if (v.status !== 'draft') throw new AppError(400, '只有草稿凭证才能删除')
    this.repo.delete(id)
  }

  submit(id: string): void {
    const v = this.assertExists(id)
    if (v.status !== 'draft') throw new AppError(400, '只有草稿凭证才能提交审核')
    this.repo.updateStatus(id, 'pending', v.preparedBy)
  }

  approve(id: string, userId: string): void {
    const v = this.assertExists(id)
    if (v.status !== 'pending') throw new AppError(400, '只有待审核凭证才能批准')
    this.repo.updateStatus(id, 'approved', userId)
  }

  reject(id: string, userId: string): void {
    const v = this.assertExists(id)
    if (v.status !== 'pending') throw new AppError(400, '只有待审核凭证才能驳回')
    this.repo.updateStatus(id, 'draft', userId)
  }

  post(id: string, userId: string): void {
    const v = this.assertExists(id)
    if (v.status !== 'approved') throw new AppError(400, '只有已审核凭证才能记账')
    this.repo.updateStatus(id, 'posted', userId)
    this.repo.recalcBalances(v.periodId)
  }

  /** 批量记账 */
  batchPost(ids: string[], userId: string): { success: number; failed: { id: string; error: string }[] } {
    let success = 0
    const failed: { id: string; error: string }[] = []
    for (const id of ids) {
      try {
        this.post(id, userId)
        success++
      } catch (err) {
        failed.push({ id, error: (err as Error).message })
      }
    }
    return { success, failed }
  }

  /** 反向记账（红字冲销） */
  reverse(id: string, userId: string): Voucher {
    const original = this.assertExists(id)
    if (original.status !== 'posted') throw new AppError(400, '只能反向已记账的凭证')

    const voucherId = uuid()
    const word = original.voucherWord ?? '记'
    const voucherNo = this.repo.nextVoucherNo(original.periodId, word)
    const lines: VoucherLine[] = (original.lines ?? []).map(l => ({
      ...l,
      id: uuid(),
      voucherId,
      direction: l.direction === 'debit' ? 'credit' : 'debit',  // 方向对调
    }))

    const reversal: Voucher = {
      id: voucherId,
      voucherNo,
      voucherWord: word,
      voucherDate: new Date().toISOString().slice(0, 10),
      periodId: original.periodId,
      summary: `红字冲销 ${original.voucherNo}：${original.summary}`,
      type: 'manual',
      status: 'draft',
      attachmentCount: 0,
      attachmentDesc: null,
      preparedBy: userId,
      reviewedBy: null,
      postedBy: null,
      reversedBy: null,
      reverseVoucherId: original.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines,
    }

    this.repo.create(reversal)
    this.repo.updateStatus(id, 'reversed', userId)
    return reversal
  }

  /** 获取下一个凭证号 */
  getNextVoucherNo(periodId: string, voucherWord: string = '记'): string {
    return this.repo.nextVoucherNo(periodId, voucherWord)
  }

  private assertExists(id: string): Voucher {
    const v = this.repo.findById(id)
    if (!v) throw new AppError(404, `凭证 ${id} 不存在`)
    return v
  }
}
