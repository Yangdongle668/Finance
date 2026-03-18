import { AccountRepository } from '../../infrastructure/repositories/AccountRepository'
import { PeriodRepository } from '../../infrastructure/repositories/PeriodRepository'
import { getDb } from '../../infrastructure/database/db'

export interface TrialBalanceRow {
  accountCode: string
  accountName: string
  level: number
  nature: string
  openingDebit: number
  openingCredit: number
  debitAmount: number
  creditAmount: number
  closingDebit: number
  closingCredit: number
}

export interface BalanceSheetItem {
  label: string
  accountCodes: string[]
  amount: number
  prevAmount: number
}

export interface IncomeStatementItem {
  label: string
  accountCodes: string[]
  amount: number
  prevAmount: number
  isSubtraction?: boolean
}

export class ReportService {
  private accountRepo = new AccountRepository()
  private periodRepo = new PeriodRepository()

  /** 科目余额表 */
  trialBalance(periodId: string): TrialBalanceRow[] {
    const accounts = this.accountRepo.findAll(true)
    const balances = this.accountRepo.getBalances(periodId)
    const balMap = new Map(balances.map(b => [b.accountCode, b]))

    return accounts.map(a => {
      const b = balMap.get(a.code)
      return {
        accountCode: a.code,
        accountName: a.name,
        level: a.level,
        nature: a.nature,
        openingDebit: (b?.openingDebit ?? 0) / 100,
        openingCredit: (b?.openingCredit ?? 0) / 100,
        debitAmount: (b?.debitAmount ?? 0) / 100,
        creditAmount: (b?.creditAmount ?? 0) / 100,
        closingDebit: (b?.closingDebit ?? 0) / 100,
        closingCredit: (b?.closingCredit ?? 0) / 100,
      }
    })
  }

  /** 明细账：某科目下某期间的凭证明细 */
  ledgerDetail(accountCode: string, periodId: string) {
    const db = getDb()
    const rows = db.prepare(`
      SELECT
        v.voucher_date, v.voucher_no, v.summary,
        vl.direction, vl.amount, vl.remark,
        v.id as voucher_id
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_code = ? AND v.period_id = ? AND v.status = 'posted'
      ORDER BY v.voucher_date, v.voucher_no
    `).all(accountCode, periodId) as {
      voucher_date: string; voucher_no: string; summary: string
      direction: string; amount: number; remark: string | null; voucher_id: string
    }[]

    // 获取期初余额
    const balanceRow = db.prepare(
      'SELECT opening_debit, opening_credit FROM account_balances WHERE account_code=? AND period_id=?'
    ).get(accountCode, periodId) as { opening_debit: number; opening_credit: number } | undefined

    const account = this.accountRepo.findByCode(accountCode)
    const isDebitNormal = account?.direction === 'debit'

    let runningBalance = ((balanceRow?.opening_debit ?? 0) - (balanceRow?.opening_credit ?? 0)) / 100

    const lines = rows.map(r => {
      const amount = r.amount / 100
      const debit = r.direction === 'debit' ? amount : 0
      const credit = r.direction === 'credit' ? amount : 0
      runningBalance += isDebitNormal ? (debit - credit) : (credit - debit)

      return {
        date: r.voucher_date,
        voucherNo: r.voucher_no,
        summary: r.summary,
        debit,
        credit,
        balance: runningBalance,
        voucherId: r.voucher_id,
        remark: r.remark,
      }
    })

    return {
      accountCode,
      accountName: account?.name ?? '',
      openingBalance: ((balanceRow?.opening_debit ?? 0) - (balanceRow?.opening_credit ?? 0)) / 100,
      lines,
    }
  }

  /** 总账：所有一级科目汇总 */
  generalLedger(periodId: string, prevPeriodId?: string) {
    const accounts = this.accountRepo.findAll(true).filter(a => a.level === 1)
    const balances = this.accountRepo.getBalances(periodId)
    const prevBalances = prevPeriodId ? this.accountRepo.getBalances(prevPeriodId) : []
    const balMap = new Map(balances.map(b => [b.accountCode, b]))
    const prevBalMap = new Map(prevBalances.map(b => [b.accountCode, b]))

    return accounts.map(a => {
      const b = balMap.get(a.code)
      const pb = prevBalMap.get(a.code)
      return {
        accountCode: a.code,
        accountName: a.name,
        nature: a.nature,
        openingBalance: ((b?.openingDebit ?? 0) - (b?.openingCredit ?? 0)) / 100,
        debitAmount: (b?.debitAmount ?? 0) / 100,
        creditAmount: (b?.creditAmount ?? 0) / 100,
        closingBalance: ((b?.closingDebit ?? 0) - (b?.closingCredit ?? 0)) / 100,
        prevClosingBalance: ((pb?.closingDebit ?? 0) - (pb?.closingCredit ?? 0)) / 100,
      }
    })
  }

  /** 资产负债表（简化版） */
  balanceSheet(periodId: string) {
    const trial = this.trialBalance(periodId)
    const get = (codes: string[]) => trial
      .filter(r => codes.some(c => r.accountCode.startsWith(c)))
      .reduce((s, r) => s + r.closingDebit - r.closingCredit, 0)

    return {
      assets: {
        current: {
          cash: get(['1001', '1002']),
          bankDeposit: get(['1002']),
          receivable: get(['1122', '1123']),
          prepaid: get(['1123']),
          inventory: get(['1401', '1402', '1403', '1405', '1406', '1407', '1408']),
          other: get(['1121', '1231']),
        },
        nonCurrent: {
          fixedAsset: get(['1601']),
          accumulatedDepreciation: -get(['1602']),
          intangible: get(['1701']),
          other: get(['1901']),
        },
      },
      liabilities: {
        current: {
          shortLoan: get(['2001']),
          payable: get(['2202', '2203', '2211', '2221']),
          advanceReceipt: get(['2203']),
          taxPayable: get(['2221']),
          other: get(['2241']),
        },
        nonCurrent: {
          longLoan: get(['2501']),
          other: get(['2701']),
        },
      },
      equity: {
        paidIn: get(['4001']),
        surplus: get(['4101', '4102']),
        retained: get(['4103']),
        currentProfit: get(['4000']),
      },
    }
  }

  /** 利润表（简化版） */
  incomeStatement(periodId: string) {
    const trial = this.trialBalance(periodId)
    const get = (codes: string[]) => trial
      .filter(r => codes.some(c => r.accountCode.startsWith(c)))
      .reduce((s, r) => s + r.debitAmount - r.creditAmount, 0)

    const revenue = -get(['6001', '6051'])                      // 营业收入（贷方）
    const costOfGoods = get(['6401'])                           // 营业成本
    const grossProfit = revenue - costOfGoods

    const sellingExp = get(['6601'])                            // 销售费用
    const adminExp = get(['6602'])                              // 管理费用
    const financeExp = get(['6603'])                            // 财务费用
    const rdExp = get(['6604'])                                 // 研发费用
    const operatingProfit = grossProfit - sellingExp - adminExp - financeExp - rdExp

    const nonOpIncome = -get(['6301'])                          // 营业外收入
    const nonOpExpense = get(['6711'])                          // 营业外支出
    const profitBeforeTax = operatingProfit + nonOpIncome - nonOpExpense

    const incomeTax = get(['6801'])                             // 所得税费用
    const netProfit = profitBeforeTax - incomeTax

    return {
      revenue,
      costOfGoods,
      grossProfit,
      grossMargin: revenue !== 0 ? grossProfit / revenue : 0,
      sellingExp,
      adminExp,
      financeExp,
      rdExp,
      operatingProfit,
      operatingMargin: revenue !== 0 ? operatingProfit / revenue : 0,
      nonOpIncome,
      nonOpExpense,
      profitBeforeTax,
      incomeTax,
      netProfit,
      netMargin: revenue !== 0 ? netProfit / revenue : 0,
    }
  }

  /** 凭证汇总表：按科目汇总某期间内凭证的借贷金额
   *  statusFilter: 'posted'(仅记账) | 'all'(全部非冲销) - 默认全部
   */
  voucherSummary(periodId: string, startDate?: string, endDate?: string, statusFilter = 'all') {
    const db = getDb()

    const statusCond = statusFilter === 'posted'
      ? `AND v.status = 'posted'`
      : `AND v.status != 'reversed'`

    const dateFilter = startDate && endDate
      ? `AND v.voucher_date BETWEEN ? AND ?`
      : ''
    const params: string[] = [periodId]
    if (startDate && endDate) { params.push(startDate, endDate) }

    const rows = db.prepare(`
      SELECT
        vl.account_code,
        vl.account_name,
        SUM(CASE WHEN vl.direction = 'debit' THEN vl.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vl.direction = 'credit' THEN vl.amount ELSE 0 END) as credit_total
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE v.period_id = ? ${statusCond} ${dateFilter}
      GROUP BY vl.account_code, vl.account_name
      ORDER BY vl.account_code
    `).all(...params) as {
      account_code: string; account_name: string; debit_total: number; credit_total: number
    }[]

    // Count vouchers
    const countRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM vouchers
      WHERE period_id = ? ${statusCond} ${dateFilter}
    `).get(...params) as { cnt: number }

    // Count attachments
    const attachRow = db.prepare(`
      SELECT COALESCE(SUM(attachment_count), 0) as cnt FROM vouchers
      WHERE period_id = ? ${statusCond} ${dateFilter}
    `).get(...params) as { cnt: number }

    return {
      rows: rows.map(r => ({
        accountCode: r.account_code,
        accountName: r.account_name,
        debitAmount: r.debit_total / 100,
        creditAmount: r.credit_total / 100,
      })),
      totalVouchers: countRow.cnt,
      totalAttachments: attachRow.cnt,
    }
  }

  /** 现金流量表（直接法，简化） */
  cashFlowStatement(periodId: string) {
    const db = getDb()
    const sum = (accountPrefix: string, direction: string) => {
      const result = db.prepare(`
        SELECT COALESCE(SUM(vl.amount), 0) as total
        FROM voucher_lines vl
        JOIN vouchers v ON vl.voucher_id = v.id
        WHERE vl.account_code LIKE ? AND vl.direction = ?
          AND v.period_id = ? AND v.status = 'posted'
      `).get(`${accountPrefix}%`, direction, periodId) as { total: number }
      return result.total / 100
    }

    const cashIn = sum('1001', 'debit') + sum('1002', 'debit')
    const cashOut = sum('1001', 'credit') + sum('1002', 'credit')

    return {
      operating: {
        inflow: cashIn,
        outflow: cashOut,
        net: cashIn - cashOut,
      },
    }
  }

  /** 财务分析仪表板 */
  dashboard(periodId: string) {
    const db = getDb()
    const income = this.incomeStatement(periodId)
    const bs = this.balanceSheet(periodId)

    // 资金余额
    const cashBalance = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN direction='debit' THEN amount ELSE -amount END), 0) as bal
      FROM voucher_lines vl JOIN vouchers v ON vl.voucher_id=v.id
      WHERE vl.account_code LIKE '1001%' AND v.period_id=? AND v.status='posted'
    `).get(periodId) as { bal: number }

    const bankBalance = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN direction='debit' THEN amount ELSE -amount END), 0) as bal
      FROM voucher_lines vl JOIN vouchers v ON vl.voucher_id=v.id
      WHERE vl.account_code LIKE '1002%' AND v.period_id=? AND v.status='posted'
    `).get(periodId) as { bal: number }

    const totalAssets = Object.values(bs.assets.current).reduce((a, b) => a + b, 0) +
                        Object.values(bs.assets.nonCurrent).reduce((a, b) => a + b, 0)
    const totalLiabilities = Object.values(bs.liabilities.current).reduce((a, b) => a + b, 0) +
                              Object.values(bs.liabilities.nonCurrent).reduce((a, b) => a + b, 0)
    const totalEquity = Object.values(bs.equity).reduce((a, b) => a + b, 0)

    return {
      funds: {
        cash: cashBalance.bal / 100,
        bank: bankBalance.bal / 100,
        total: (cashBalance.bal + bankBalance.bal) / 100,
        receivable: bs.assets.current.receivable,
        payable: bs.liabilities.current.payable,
      },
      profitability: {
        netProfit: income.netProfit,
        grossMargin: income.grossMargin,
        netMargin: income.netMargin,
        operatingMargin: income.operatingMargin,
      },
      solvency: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        debtRatio: totalAssets !== 0 ? totalLiabilities / totalAssets : 0,
        currentRatio: bs.liabilities.current.payable !== 0
          ? (bs.assets.current.cash + bs.assets.current.receivable + bs.assets.current.inventory) / bs.liabilities.current.payable
          : 0,
      },
    }
  }
}
