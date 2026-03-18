export interface ClosingTemplate {
  id: string
  name: string
  type: 'system' | 'custom'
  systemKey: string | null
  isEnabled: boolean
  isSystem: boolean
  sortOrder: number
  voucherWord: string
  summary: string | null
  config: Record<string, unknown> | null
  lines: ClosingTemplateLine[]
  createdAt: string
  updatedAt: string
}

export interface ClosingTemplateLine {
  id: string
  templateId: string
  lineNo: number
  summary: string
  accountCode: string
  accountName: string
  direction: 'debit' | 'credit'
  amountType: 'balance_out' | 'balance_in' | 'fixed'
  ratio: number
}

export interface ClosingSummaryItem {
  templateId: string
  name: string
  type: 'system' | 'custom'
  systemKey: string | null
  isEnabled: boolean
  isSystem: boolean
  sortOrder: number
  transferred: number
  pending: number
  voucherId: string | null
  voucherStatus: string | null
}

export interface CreateTemplateData {
  name: string
  voucherWord?: string
  summary?: string
  lines?: {
    lineNo: number
    summary: string
    accountCode: string
    accountName: string
    direction: 'debit' | 'credit'
    amountType: 'balance_out' | 'balance_in' | 'fixed'
    ratio: number
  }[]
}

export interface UpdateTemplateData {
  name?: string
  isEnabled?: boolean
  voucherWord?: string
  summary?: string
  config?: Record<string, unknown>
  lines?: {
    lineNo: number
    summary: string
    accountCode: string
    accountName: string
    direction: 'debit' | 'credit'
    amountType: 'balance_out' | 'balance_in' | 'fixed'
    ratio: number
  }[]
}
