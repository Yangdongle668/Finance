import axios, { AxiosError } from 'axios'
import { message } from 'antd'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截 - 附加 JWT + Company ID
client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const companyId = localStorage.getItem('companyId')
  if (companyId) config.headers['X-Company-Id'] = companyId
  return config
})

// 响应拦截 - 统一错误处理
client.interceptors.response.use(
  res => res,
  (err: AxiosError<{ message?: string }>) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(err)
    }
    const msg = err.response?.data?.message || err.message || '请求失败'
    message.error(msg)
    return Promise.reject(new Error(msg))
  }
)

export default client

// ── API helpers ───────────────────────────────────────────

export const api = {
  // Auth
  login: (data: { username: string; password: string }) =>
    client.post<ApiResponse<{ token: string; user: User; companies: CompanyBrief[] }>>('/auth/login', data),
  me: () => client.get<ApiResponse<UserWithCompanies>>('/auth/me'),
  updateProfile: (data: { name?: string; email?: string; phone?: string; avatar?: string }) =>
    client.put<ApiResponse<User>>('/auth/profile', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    client.post('/auth/change-password', data),
  listUsers: () => client.get<ApiResponse<User[]>>('/auth/users'),
  createUser: (data: Partial<User> & { password?: string }) =>
    client.post<ApiResponse<{ id: string }>>('/auth/users', data),
  toggleUser: (id: string) => client.put(`/auth/users/${id}/toggle`),

  // Companies (account sets)
  listCompanies: () => client.get<ApiResponse<Company[]>>('/companies'),
  getCompany: (id: string) => client.get<ApiResponse<Company>>(`/companies/${id}`),
  createCompany: (data: Partial<Company>) => client.post<ApiResponse<{ id: string }>>('/companies', data),
  updateCompany: (id: string, data: Partial<Company>) => client.put<ApiResponse<Company>>(`/companies/${id}`, data),
  listCompanyUsers: (companyId: string) => client.get<ApiResponse<CompanyUser[]>>(`/companies/${companyId}/users`),
  addCompanyUser: (companyId: string, data: { userId: string; role?: string; permissions?: string[] }) =>
    client.post(`/companies/${companyId}/users`, data),
  updateCompanyUser: (companyId: string, userId: string, data: { role?: string; permissions?: string[] }) =>
    client.put(`/companies/${companyId}/users/${userId}`, data),
  removeCompanyUser: (companyId: string, userId: string) =>
    client.delete(`/companies/${companyId}/users/${userId}`),

  // Periods
  listPeriods: () => client.get<ApiResponse<Period[]>>('/periods'),
  currentPeriod: () => client.get<ApiResponse<Period>>('/periods/current'),
  ensurePeriods: (year: number) => client.post(`/periods/ensure/${year}`),
  closePeriod: (id: string) => client.post(`/periods/${id}/close`),
  reopenPeriod: (id: string) => client.post(`/periods/${id}/reopen`),

  // Accounts
  listAccounts: (enabledOnly = false) =>
    client.get<ApiResponse<Account[]>>(`/accounts?enabledOnly=${enabledOnly}`),
  leafAccounts: () => client.get<ApiResponse<Account[]>>('/accounts/leaf'),
  createAccount: (data: Partial<Account>) => client.post('/accounts', data),
  updateAccount: (code: string, data: Partial<Account>) => client.patch(`/accounts/${code}`, data),
  listDimensions: (type?: string) =>
    client.get<ApiResponse<Dimension[]>>(`/accounts/dimensions/list${type ? `?type=${type}` : ''}`),

  // Vouchers
  listVouchers: (params: VoucherFilter) =>
    client.get<PaginatedResponse<Voucher>>('/vouchers', { params }),
  getVoucher: (id: string) => client.get<ApiResponse<Voucher>>(`/vouchers/${id}`),
  getNextVoucherNo: (periodId: string, voucherWord = '记') =>
    client.get<ApiResponse<{ voucherNo: string }>>('/vouchers/next-no', { params: { periodId, voucherWord } }),
  createVoucher: (data: CreateVoucherPayload) =>
    client.post<ApiResponse<Voucher>>('/vouchers', data),
  updateVoucher: (id: string, data: UpdateVoucherPayload) =>
    client.put<ApiResponse<Voucher>>(`/vouchers/${id}`, data),
  deleteVoucher: (id: string) =>
    client.delete<ApiResponse<null>>(`/vouchers/${id}`),
  submitVoucher: (id: string) => client.post(`/vouchers/${id}/submit`),
  approveVoucher: (id: string) => client.post(`/vouchers/${id}/approve`),
  rejectVoucher: (id: string) => client.post(`/vouchers/${id}/reject`),
  postVoucher: (id: string) => client.post(`/vouchers/${id}/post`),
  batchPostVouchers: (ids: string[]) => client.post('/vouchers/batch-post', { ids }),
  reverseVoucher: (id: string) => client.post(`/vouchers/${id}/reverse`),

  // Attachments
  listAttachments: (params?: AttachmentFilter) =>
    client.get<PaginatedResponse<AttachmentItem>>('/attachments', { params }),
  createAttachment: (data: Partial<AttachmentItem>) =>
    client.post<ApiResponse<AttachmentItem>>('/attachments', data),
  deleteAttachment: (id: string) =>
    client.delete<ApiResponse<null>>(`/attachments/${id}`),
  linkAttachment: (id: string, voucherId: string | null) =>
    client.patch(`/attachments/${id}/link`, { voucherId }),
  listAttachmentCategories: () =>
    client.get<ApiResponse<AttachmentCategory[]>>('/attachments/categories'),
  createAttachmentCategory: (data: { name: string; parentId?: string; sortOrder?: number }) =>
    client.post<ApiResponse<AttachmentCategory>>('/attachments/categories', data),

  // Reports
  trialBalance: (periodId: string) =>
    client.get<ApiResponse<TrialBalanceRow[]>>(`/reports/trial-balance/${periodId}`),
  ledger: (accountCode: string, periodId: string) =>
    client.get<ApiResponse<LedgerResult>>(`/reports/ledger/${accountCode}?periodId=${periodId}`),
  generalLedger: (periodId: string) =>
    client.get<ApiResponse<GeneralLedgerRow[]>>(`/reports/general-ledger/${periodId}`),
  balanceSheet: (periodId: string) =>
    client.get<ApiResponse<BalanceSheet>>(`/reports/balance-sheet/${periodId}`),
  incomeStatement: (periodId: string) =>
    client.get<ApiResponse<IncomeStatement>>(`/reports/income-statement/${periodId}`),
  dashboard: (periodId: string) =>
    client.get<ApiResponse<Dashboard>>(`/reports/dashboard/${periodId}`),
  voucherSummary: (periodId: string, startDate?: string, endDate?: string, statusFilter?: string) =>
    client.get<ApiResponse<VoucherSummaryResult>>(`/reports/voucher-summary/${periodId}`, { params: { startDate, endDate, statusFilter } }),

  // Closing
  listClosingTemplates: () => client.get<ApiResponse<ClosingTemplate[]>>('/closing/templates'),
  createClosingTemplate: (data: Partial<ClosingTemplate> & { lines?: Partial<ClosingTemplateLine>[] }) =>
    client.post<ApiResponse<ClosingTemplate>>('/closing/templates', data),
  updateClosingTemplate: (id: string, data: Partial<ClosingTemplate> & { lines?: Partial<ClosingTemplateLine>[] }) =>
    client.put<ApiResponse<ClosingTemplate>>(`/closing/templates/${id}`, data),
  deleteClosingTemplate: (id: string) =>
    client.delete<ApiResponse<null>>(`/closing/templates/${id}`),
  closingSummary: (periodId: string) =>
    client.get<ApiResponse<ClosingSummaryItem[]>>(`/closing/summary/${periodId}`),
  generateClosingVoucher: (templateId: string, periodId: string) =>
    client.post<ApiResponse<{ voucherId: string }>>(`/closing/generate/${templateId}`, { periodId }),
  closingClose: (periodId: string) =>
    client.post<ApiResponse<null>>(`/closing/${periodId}/close`),
  closingReopen: (periodId: string) =>
    client.post<ApiResponse<null>>(`/closing/${periodId}/reopen`),

  // Assets
  listAssets: (params?: { status?: string; category?: string }) =>
    client.get<ApiResponse<Asset[]>>('/assets', { params }),
  createAsset: (data: Partial<Asset>) => client.post('/assets', data),

  // Companies (账套管理)
  listCompanies: () => client.get<ApiResponse<Company[]>>('/companies'),
  getCompany: (id: string) => client.get<ApiResponse<Company>>(`/companies/${id}`),
  createCompany: (data: Partial<Company>) => client.post<ApiResponse<Company>>('/companies', data),
  updateCompany: (id: string, data: Partial<Company>) => client.put<ApiResponse<null>>(`/companies/${id}`, data),
  deleteCompany: (id: string) => client.delete<ApiResponse<null>>(`/companies/${id}`),

  // Invoices
  listInvoices: (params?: InvoiceFilter) =>
    client.get<PaginatedResponse<Invoice>>('/invoices', { params }),
  createInvoice: (data: Partial<Invoice>) => client.post('/invoices', data),
  certifyInvoice: (id: string) => client.patch(`/invoices/${id}/certify`),
  invoiceStats: (params?: { startDate?: string; endDate?: string }) =>
    client.get<ApiResponse<InvoiceStats[]>>('/invoices/stats', { params }),
}

// ── Types ─────────────────────────────────────────────────

export interface ApiResponse<T> { code: number; message: string; data: T }
export interface PaginatedResponse<T> {
  code: number; message: string; data: T[]; total: number; page: number; pageSize: number; totalPages: number
}

export interface User { id: string; username: string; name: string; email?: string; phone?: string; avatar?: string; isEnabled?: boolean; lastLogin?: string }
export interface UserWithCompanies extends User { companies: CompanyBrief[] }
export interface CompanyBrief { id: string; name: string; role: string; permissions: string[] | null }
export interface Company { id: string; name: string; taxNo?: string; legalPerson?: string; industry?: string; address?: string; phone?: string; fiscalYearStart: number; accountingStandard: string; currency: string; status: string; role?: string; createdAt: string; updatedAt: string }
export interface CompanyUser { id: string; username: string; name: string; email?: string; phone?: string; isEnabled: boolean; role: string; permissions: string | null }
export interface Period { id: string; year: number; month: number; name: string; startDate: string; endDate: string; status: 'open' | 'closing' | 'closed' }
export interface Account { code: string; name: string; level: number; nature: string; direction: string; parentCode?: string | null; isLeaf: boolean; isEnabled: boolean; remark?: string | null }
export interface Dimension { id: string; type: string; code: string; name: string; isEnabled: boolean }

export type VoucherWord = '记' | '收' | '付' | '转'

export interface VoucherLine {
  id: string; accountCode: string; accountName: string; direction: 'debit' | 'credit'
  amount: number; departmentId?: string; projectId?: string; remark?: string
}
export interface Voucher {
  id: string; voucherNo: string; voucherWord: VoucherWord; voucherDate: string; periodId: string; summary: string
  type: string; status: 'draft' | 'pending' | 'approved' | 'posted' | 'reversed'
  preparedBy: string; preparedByName?: string; reviewedBy?: string; reviewedByName?: string
  attachmentCount?: number; lines?: VoucherLine[]
  createdAt: string; updatedAt: string
}
export interface VoucherFilter {
  periodId?: string; status?: string; keyword?: string; accountCode?: string
  page?: number; pageSize?: number; startDate?: string; endDate?: string
  voucherWord?: string; includeLines?: boolean
}
export interface CreateVoucherPayload {
  voucherDate: string; periodId: string; summary: string; voucherWord?: VoucherWord
  attachmentCount?: number
  lines: { accountCode: string; direction: string; amount: number; summary?: string; remark?: string }[]
}
export interface UpdateVoucherPayload {
  voucherDate?: string; summary?: string; voucherWord?: VoucherWord
  attachmentCount?: number
  lines?: { accountCode: string; direction: string; amount: number; summary?: string; remark?: string }[]
}

// Attachments
export interface AttachmentItem {
  id: string; name: string; remark: string | null; categoryId: string | null
  amount: number; periodId: string | null; voucherId: string | null
  uploadDate: string; createdAt: string; updatedAt: string
}
export interface AttachmentCategory {
  id: string; name: string; parentId: string | null; sortOrder: number
}
export interface AttachmentFilter {
  categoryId?: string; periodId?: string; name?: string
  startDate?: string; endDate?: string; page?: number; pageSize?: number
}

export interface TrialBalanceRow { accountCode: string; accountName: string; level: number; nature: string; openingDebit: number; openingCredit: number; debitAmount: number; creditAmount: number; closingDebit: number; closingCredit: number }
export interface LedgerResult { accountCode: string; accountName: string; openingBalance: number; lines: { date: string; voucherNo: string; summary: string; debit: number; credit: number; balance: number }[] }
export interface GeneralLedgerRow { accountCode: string; accountName: string; nature: string; openingBalance: number; debitAmount: number; creditAmount: number; closingBalance: number; prevClosingBalance: number }
export interface BalanceSheet { assets: Record<string, Record<string, number>>; liabilities: Record<string, Record<string, number>>; equity: Record<string, number> }
export interface IncomeStatement { revenue: number; costOfGoods: number; grossProfit: number; grossMargin: number; sellingExp: number; adminExp: number; financeExp: number; operatingProfit: number; operatingMargin: number; netProfit: number; netMargin: number }
export interface Dashboard { funds: { cash: number; bank: number; total: number; receivable: number; payable: number }; profitability: { netProfit: number; grossMargin: number; netMargin: number }; solvency: { totalAssets: number; totalLiabilities: number; debtRatio: number } }

export interface VoucherSummaryRow { accountCode: string; accountName: string; debitAmount: number; creditAmount: number }
export interface VoucherSummaryResult { rows: VoucherSummaryRow[]; totalVouchers: number; totalAttachments: number }

export interface ClosingTemplateLine {
  id: string; templateId: string; lineNo: number; summary: string
  accountCode: string; accountName: string
  direction: 'debit' | 'credit'; amountType: 'balance_out' | 'balance_in' | 'fixed'; ratio: number
}
export interface ClosingTemplate {
  id: string; name: string; type: 'system' | 'custom'; systemKey: string | null
  isEnabled: boolean; isSystem: boolean; sortOrder: number
  voucherWord: string; summary: string | null
  config: Record<string, unknown> | null; lines: ClosingTemplateLine[]
  createdAt: string; updatedAt: string
}
export interface ClosingSummaryItem {
  templateId: string; name: string; type: 'system' | 'custom'; systemKey: string | null
  isEnabled: boolean; isSystem: boolean; sortOrder: number
  transferred: number; pending: number; voucherId: string | null; voucherStatus: string | null
}

export interface Company {
  id: string; name: string; taxNo: string | null; legalPerson: string | null
  industry: string | null; address: string | null; phone: string | null
  fiscalYearStart: number; accountingStandard: 'small' | 'general'; currency: string
  createdAt: string; updatedAt: string
}

export interface Asset { id: string; assetNo: string; name: string; category: string; originalValue: number; usefulLife: number; acquiredDate: string; status: string }
export interface Invoice { id: string; direction: string; invoiceType: string; invoiceNo: string; invoiceDate: string; sellerName: string; totalAmount: number; taxAmount: number; status: string }
export interface InvoiceFilter { direction?: string; status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }
export interface InvoiceStats { direction: string; count: number; total_ex_tax: number; total_tax: number; total_amount: number }
