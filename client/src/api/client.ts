import axios, { AxiosError } from 'axios'
import { message } from 'antd'

const client = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

// 请求拦截 - 附加 JWT + Company ID
client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Attach company ID from localStorage
  try {
    const companyStorage = localStorage.getItem('company-storage')
    if (companyStorage) {
      const parsed = JSON.parse(companyStorage)
      const companyId = parsed?.state?.currentCompany?.id
      if (companyId) {
        config.headers['x-company-id'] = companyId
      }
    }
  } catch { /* ignore parse errors */ }

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
  // Companies
  listCompanies: () => client.get<ApiResponse<Company[]>>('/companies'),
  createCompany: (data: { name: string }) => client.post<ApiResponse<{ id: string; name: string }>>('/companies', data),
  updateCompany: (id: string, data: { name: string }) => client.patch(`/companies/${id}`, data),
  deleteCompany: (id: string) => client.delete(`/companies/${id}`),

  // Auth
  login: (data: { username: string; password: string }) =>
    client.post<ApiResponse<{ token: string; user: User }>>('/auth/login', data),
  me: () => client.get<ApiResponse<User>>('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    client.post('/auth/change-password', data),
  listUsers: () => client.get<ApiResponse<User[]>>('/auth/users'),
  createUser: (data: Partial<User> & { password?: string }) =>
    client.post<ApiResponse<{ id: string }>>('/auth/users', data),

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
  deleteAccount: (code: string) => client.delete(`/accounts/${code}`),
  listDimensions: (type?: string) =>
    client.get<ApiResponse<Dimension[]>>(`/accounts/dimensions/list${type ? `?type=${type}` : ''}`),

  // Vouchers
  listVouchers: (params: VoucherFilter) =>
    client.get<PaginatedResponse<Voucher>>('/vouchers', { params }),
  getVoucher: (id: string) => client.get<ApiResponse<Voucher>>(`/vouchers/${id}`),
  createVoucher: (data: CreateVoucherPayload) =>
    client.post<ApiResponse<Voucher>>('/vouchers', data),
  submitVoucher: (id: string) => client.post(`/vouchers/${id}/submit`),
  approveVoucher: (id: string) => client.post(`/vouchers/${id}/approve`),
  rejectVoucher: (id: string) => client.post(`/vouchers/${id}/reject`),
  postVoucher: (id: string) => client.post(`/vouchers/${id}/post`),
  batchPostVouchers: (ids: string[]) => client.post('/vouchers/batch-post', { ids }),
  reverseVoucher: (id: string) => client.post(`/vouchers/${id}/reverse`),

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
    client.get<ApiResponse<DashboardData>>(`/reports/dashboard/${periodId}`),

  // Assets
  listAssets: (params?: { status?: string; category?: string }) =>
    client.get<ApiResponse<Asset[]>>('/assets', { params }),
  createAsset: (data: Partial<Asset>) => client.post('/assets', data),

  // Invoices
  listInvoices: (params?: InvoiceFilter) =>
    client.get<PaginatedResponse<Invoice>>('/invoices', { params }),
  createInvoice: (data: Partial<Invoice>) => client.post('/invoices', data),
  certifyInvoice: (id: string) => client.patch(`/invoices/${id}/certify`),
  parseInvoicePdf: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post<ApiResponse<ParsedInvoice>>('/invoices/parse-pdf', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  parseInvoiceImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post<ApiResponse<ParsedInvoice>>('/invoices/parse-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },
  invoiceStats: (params?: { startDate?: string; endDate?: string }) =>
    client.get<ApiResponse<InvoiceStats[]>>('/invoices/stats', { params }),
}

// ── Types ─────────────────────────────────────────────────

export interface ApiResponse<T> { code: number; message: string; data: T }
export interface PaginatedResponse<T> {
  code: number; message: string; data: T[]; total: number; page: number; pageSize: number; totalPages: number
}

export interface Company { id: string; name: string; created_at: string; updated_at: string }
export interface User { id: string; username: string; name: string; role: string; email?: string; isEnabled?: boolean; lastLogin?: string }
export interface Period { id: string; year: number; month: number; name: string; startDate: string; endDate: string; status: 'open' | 'closing' | 'closed' }
export interface Account { code: string; name: string; level: number; nature: string; direction: string; parentCode?: string; isLeaf: boolean; isEnabled: boolean }
export interface Dimension { id: string; type: string; code: string; name: string; isEnabled: boolean }

export interface VoucherLine {
  id: string; accountCode: string; accountName: string; direction: 'debit' | 'credit'
  amount: number; departmentId?: string; projectId?: string; remark?: string
}
export interface Voucher {
  id: string; voucherNo: string; voucherDate: string; periodId: string; summary: string
  type: string; status: 'draft' | 'pending' | 'approved' | 'posted' | 'reversed'
  preparedBy: string; reviewedBy?: string; attachmentCount?: number; lines?: VoucherLine[]
  createdAt: string; updatedAt: string
}
export interface VoucherFilter { periodId?: string; status?: string; keyword?: string; accountCode?: string; page?: number; pageSize?: number; startDate?: string; endDate?: string }
export interface CreateVoucherPayload { voucherDate: string; periodId: string; summary: string; lines: { accountCode: string; direction: string; amount: number; remark?: string }[] }

export interface TrialBalanceRow { accountCode: string; accountName: string; level: number; nature: string; openingDebit: number; openingCredit: number; debitAmount: number; creditAmount: number; closingDebit: number; closingCredit: number }
export interface LedgerResult { accountCode: string; accountName: string; openingBalance: number; lines: { date: string; voucherNo: string; summary: string; debit: number; credit: number; balance: number }[] }
export interface GeneralLedgerRow { accountCode: string; accountName: string; nature: string; openingBalance: number; debitAmount: number; creditAmount: number; closingBalance: number; prevClosingBalance: number }
export interface BalanceSheet { assets: Record<string, Record<string, number>>; liabilities: Record<string, Record<string, number>>; equity: Record<string, number> }
export interface IncomeStatement { revenue: number; costOfGoods: number; grossProfit: number; grossMargin: number; sellingExp: number; adminExp: number; financeExp: number; operatingProfit: number; operatingMargin: number; netProfit: number; netMargin: number }

export interface DashboardData {
  funds: { cash: number; bank: number; total: number; receivable: number; payable: number }
  fundDetails: { bankDeposit: number; cashOnHand: number; netCashFlow: number; cashIncome: number; cashExpense: number }
  receivablePayable: {
    totalReceivable: number; totalPayable: number
    topReceivables: { name: string; amount: number }[]
    topPayables: { name: string; amount: number }[]
  }
  estimatedFunds: {
    total: number; currentFunds: number; shortTermReceivable: number; shortTermPayable: number
    cashRatio: number; quickRatio: number; prevCashRatio: number | null; prevQuickRatio: number | null
  }
  profitability: {
    netProfit: number; grossMargin: number; netMargin: number; operatingMargin: number
    revenue: number; costOfGoods: number; grossProfit: number
    prevNetProfit: number | null; prevRevenue: number | null; prevCost: number | null; prevNetMargin: number | null
    sameYearNetProfit: number | null; sameYearRevenue: number | null; sameYearCost: number | null; sameYearNetMargin: number | null
    netProfitChangeVsPrev: number | null; netProfitChangeVsSameYear: number | null
    revenueChangeVsPrev: number | null; revenueChangeVsSameYear: number | null
    costChangeVsPrev: number | null; costChangeVsSameYear: number | null
    netMarginChangeVsPrev: number | null; netMarginChangeVsSameYear: number | null
  }
  expenses: {
    total: number; breakdown: { name: string; value: number }[]
    prevTotal: number | null; sameYearTotal: number | null
    expenseChangeVsPrev: number | null; expenseChangeVsSameYear: number | null
  }
  solvency: {
    totalAssets: number; totalLiabilities: number; totalEquity: number
    debtRatio: number; currentRatio: number; quickRatio: number; cashRatio: number
  }
  trend: { period: string; revenue: number; cost: number; netProfit: number; netMargin: number }[]
}

export interface Asset { id: string; assetNo: string; name: string; category: string; originalValue: number; usefulLife: number; acquiredDate: string; status: string }
export interface Invoice { id: string; direction: string; invoiceType: string; invoiceNo: string; invoiceDate: string; sellerName: string; totalAmount: number; taxAmount: number; status: string; amountExTax: number }
export interface InvoiceFilter { direction?: string; status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }
export interface InvoiceStats { direction: string; count: number; total_ex_tax: number; total_tax: number; total_amount: number }
export interface ParsedInvoice { invoiceNo?: string; invoiceCode?: string; invoiceDate?: string; sellerName?: string; sellerTaxNo?: string; buyerName?: string; buyerTaxNo?: string; amountExTax?: number; taxRate?: number; taxAmount?: number; totalAmount?: number; invoiceType?: string; rawText?: string; ocrFailed?: boolean }
