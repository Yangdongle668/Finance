/** 凭证字 */
export type VoucherWord = '记' | '收' | '付' | '转'

/** 凭证状态 */
export type VoucherStatus = 'draft' | 'pending' | 'approved' | 'posted' | 'reversed'

/** 凭证类型 */
export type VoucherType = 'manual' | 'system' | 'carry_forward' | 'depreciation' | 'payroll' | 'tax'

/** 借贷方向 */
export type EntryDirection = 'debit' | 'credit'

/** 凭证行 */
export interface VoucherLine {
  id: string
  voucherId: string
  lineNo: number          // 行号
  accountCode: string     // 科目代码
  accountName: string     // 科目名称（冗余，方便查询）
  direction: EntryDirection
  amount: number          // 金额（单位：分，避免浮点精度问题）
  // 核算项目维度
  departmentId: string | null
  projectId: string | null
  customerId: string | null
  supplierId: string | null
  remark: string | null
}

/** 凭证主表 */
export interface Voucher {
  id: string
  voucherNo: string       // 凭证号（格式：记-1）
  voucherWord: VoucherWord // 凭证字（记/收/付/转）
  voucherDate: string     // 凭证日期（YYYY-MM-DD）
  periodId: string        // 所属期间
  summary: string         // 摘要
  type: VoucherType
  status: VoucherStatus
  attachmentCount: number // 附件数量
  attachmentDesc: string | null
  preparedBy: string      // 制单人 userId
  reviewedBy: string | null // 审核人
  postedBy: string | null   // 记账人
  reversedBy: string | null // 反向记账人
  reverseVoucherId: string | null // 反向凭证ID
  createdAt: string
  updatedAt: string
  lines?: VoucherLine[]
}

/** 凭证过滤条件 */
export interface VoucherFilter {
  periodId?: string
  startDate?: string
  endDate?: string
  status?: VoucherStatus
  accountCode?: string
  keyword?: string        // 凭证号 or 摘要
  type?: VoucherType
  voucherWord?: VoucherWord
  includeLines?: boolean  // 是否包含凭证行明细
  page?: number
  pageSize?: number
}

/** 附件分类 */
export interface AttachmentCategory {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

/** 附件 */
export interface Attachment {
  id: string
  name: string
  remark: string | null
  categoryId: string | null
  amount: number          // 金额（分）
  periodId: string | null
  voucherId: string | null
  uploadDate: string
  createdAt: string
  updatedAt: string
}

/** 附件过滤条件 */
export interface AttachmentFilter {
  categoryId?: string
  periodId?: string
  name?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}
