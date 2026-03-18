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

    const revenue = -get(['6001', '6051'])
    const costOfGoods = get(['6401'])
    const grossProfit = revenue - costOfGoods

    const sellingExp = get(['6601'])
    const adminExp = get(['6602'])
    const financeExp = get(['6603'])
    const rdExp = get(['6604'])
    const operatingProfit = grossProfit - sellingExp - adminExp - financeExp - rdExp

    const nonOpIncome = -get(['6301'])
    const nonOpExpense = get(['6711'])
    const profitBeforeTax = operatingProfit + nonOpIncome - nonOpExpense

    const incomeTax = get(['6801'])
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

  /** 财务分析仪表板（增强版） */
  dashboard(periodId: string) {
    const db = getDb()
    const income = this.incomeStatement(periodId)
    const bs = this.balanceSheet(periodId)

    // Get period info to find previous and same period last year
    const period = this.periodRepo.findById(periodId)
    let prevIncome: ReturnType<ReportService['incomeStatement']> | null = null
    let sameLastYearIncome: ReturnType<ReportService['incomeStatement']> | null = null

    if (period) {
      // Previous period
      const prevMonth = period.month === 1 ? 12 : period.month - 1
      const prevYear = period.month === 1 ? period.year - 1 : period.year
      const prevPeriod = this.periodRepo.findByYearMonth(prevYear, prevMonth)
      if (prevPeriod) {
        prevIncome = this.incomeStatement(prevPeriod.id)
      }

      // Same period last year
      const lastYearPeriod = this.periodRepo.findByYearMonth(period.year - 1, period.month)
      if (lastYearPeriod) {
        sameLastYearIncome = this.incomeStatement(lastYearPeriod.id)
      }
    }

    // Fund balance
    const getAccountBalance = (prefix: string) => {
      const trial = this.trialBalance(periodId)
      return trial
        .filter(r => r.accountCode.startsWith(prefix))
        .reduce((s, r) => s + r.closingDebit - r.closingCredit, 0)
    }

    const bankBalance = getAccountBalance('1002')
    const cashBalance = getAccountBalance('1001')
    const totalFunds = bankBalance + cashBalance

    // Receivable/Payable
    const receivable = getAccountBalance('1122')
    const payable = Math.abs(getAccountBalance('2202'))
    const prepaid = getAccountBalance('1123')
    const advanceReceipt = Math.abs(getAccountBalance('2203'))

    // Short-term receivable/payable (approximation: use total)
    const shortTermReceivable = receivable
    const shortTermPayable = payable

    // Estimated available funds
    const estimatedFunds = totalFunds + shortTermReceivable - shortTermPayable

    // Total assets & liabilities
    const totalAssets = Object.values(bs.assets.current).reduce((a, b) => a + b, 0) +
                        Object.values(bs.assets.nonCurrent).reduce((a, b) => a + b, 0)
    const totalCurrentLiabilities = Object.values(bs.liabilities.current).reduce((a, b) => a + b, 0)
    const totalLiabilities = totalCurrentLiabilities +
                              Object.values(bs.liabilities.nonCurrent).reduce((a, b) => a + b, 0)

    // Current assets for ratios
    const currentAssets = Object.values(bs.assets.current).reduce((a, b) => a + b, 0)
    const quickAssets = currentAssets - (bs.assets.current.inventory || 0)

    // Ratios
    const currentRatio = totalCurrentLiabilities !== 0 ? currentAssets / totalCurrentLiabilities : 0
    const quickRatio = totalCurrentLiabilities !== 0 ? quickAssets / totalCurrentLiabilities : 0
    const cashRatio = totalCurrentLiabilities !== 0 ? totalFunds / totalCurrentLiabilities : 0

    // Expense breakdown
    const expenseBreakdown = [
      { name: '管理费用', value: income.adminExp },
      { name: '销售费用', value: income.sellingExp },
      { name: '财务费用', value: income.financeExp },
      { name: '研发费用', value: income.rdExp || 0 },
    ].filter(e => e.value > 0)

    const totalExpenses = income.adminExp + income.sellingExp + income.financeExp + (income.rdExp || 0)

    // Top receivable/payable (from voucher lines with remark as counterparty)
    const topReceivables = db.prepare(`
      SELECT vl.remark as name, SUM(CASE WHEN vl.direction='debit' THEN vl.amount ELSE -vl.amount END) as amount
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_code LIKE '1122%' AND v.status = 'posted'
      GROUP BY vl.remark
      HAVING amount > 0
      ORDER BY amount DESC
      LIMIT 5
    `).all() as { name: string | null; amount: number }[]

    const topPayables = db.prepare(`
      SELECT vl.remark as name, SUM(CASE WHEN vl.direction='credit' THEN vl.amount ELSE -vl.amount END) as amount
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_code LIKE '2202%' AND v.status = 'posted'
      GROUP BY vl.remark
      HAVING amount > 0
      ORDER BY amount DESC
      LIMIT 5
    `).all() as { name: string | null; amount: number }[]

    // Trend data (last 6 periods)
    const trendData: { period: string; revenue: number; cost: number; netProfit: number; netMargin: number }[] = []
    if (period) {
      const periods = this.periodRepo.findAll()
        .filter(p => p.year * 100 + p.month <= period.year * 100 + period.month)
        .sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month))
        .slice(-6)

      for (const p of periods) {
        const pIncome = this.incomeStatement(p.id)
        trendData.push({
          period: `${p.month}月`,
          revenue: pIncome.revenue,
          cost: pIncome.costOfGoods,
          netProfit: pIncome.netProfit,
          netMargin: pIncome.netMargin,
        })
      }
    }

    // Period-over-period changes
    const calcChange = (current: number, prev: number | null) => {
      if (prev === null || prev === 0) return null
      return (current - prev) / Math.abs(prev)
    }

    // Cash flow for the period
    const cashIn = this.getCashFlow(periodId, 'debit')
    const cashOut = this.getCashFlow(periodId, 'credit')

    return {
      funds: {
        cash: cashBalance,
        bank: bankBalance,
        total: totalFunds,
        receivable,
        payable,
      },
      fundDetails: {
        bankDeposit: bankBalance,
        cashOnHand: cashBalance,
        netCashFlow: cashIn - cashOut,
        cashIncome: cashIn,
        cashExpense: cashOut,
      },
      receivablePayable: {
        totalReceivable: receivable,
        totalPayable: payable,
        topReceivables: topReceivables.map(r => ({
          name: r.name || '未分类',
          amount: r.amount / 100,
        })),
        topPayables: topPayables.map(r => ({
          name: r.name || '未分类',
          amount: r.amount / 100,
        })),
      },
      estimatedFunds: {
        total: estimatedFunds,
        currentFunds: totalFunds,
        shortTermReceivable,
        shortTermPayable,
        cashRatio,
        quickRatio,
        prevCashRatio: null as number | null,
        prevQuickRatio: null as number | null,
      },
      profitability: {
        netProfit: income.netProfit,
        grossMargin: income.grossMargin,
        netMargin: income.netMargin,
        operatingMargin: income.operatingMargin,
        revenue: income.revenue,
        costOfGoods: income.costOfGoods,
        grossProfit: income.grossProfit,
        // Period comparisons
        prevNetProfit: prevIncome?.netProfit ?? null,
        prevRevenue: prevIncome?.revenue ?? null,
        prevCost: prevIncome?.costOfGoods ?? null,
        prevNetMargin: prevIncome?.netMargin ?? null,
        sameYearNetProfit: sameLastYearIncome?.netProfit ?? null,
        sameYearRevenue: sameLastYearIncome?.revenue ?? null,
        sameYearCost: sameLastYearIncome?.costOfGoods ?? null,
        sameYearNetMargin: sameLastYearIncome?.netMargin ?? null,
        // Change rates
        netProfitChangeVsPrev: calcChange(income.netProfit, prevIncome?.netProfit ?? null),
        netProfitChangeVsSameYear: calcChange(income.netProfit, sameLastYearIncome?.netProfit ?? null),
        revenueChangeVsPrev: calcChange(income.revenue, prevIncome?.revenue ?? null),
        revenueChangeVsSameYear: calcChange(income.revenue, sameLastYearIncome?.revenue ?? null),
        costChangeVsPrev: calcChange(income.costOfGoods, prevIncome?.costOfGoods ?? null),
        costChangeVsSameYear: calcChange(income.costOfGoods, sameLastYearIncome?.costOfGoods ?? null),
        netMarginChangeVsPrev: prevIncome ? income.netMargin - prevIncome.netMargin : null,
        netMarginChangeVsSameYear: sameLastYearIncome ? income.netMargin - sameLastYearIncome.netMargin : null,
      },
      expenses: {
        total: totalExpenses,
        breakdown: expenseBreakdown,
        prevTotal: prevIncome ? (prevIncome.adminExp + prevIncome.sellingExp + prevIncome.financeExp + (prevIncome.rdExp || 0)) : null,
        sameYearTotal: sameLastYearIncome ? (sameLastYearIncome.adminExp + sameLastYearIncome.sellingExp + sameLastYearIncome.financeExp + (sameLastYearIncome.rdExp || 0)) : null,
        expenseChangeVsPrev: calcChange(
          totalExpenses,
          prevIncome ? (prevIncome.adminExp + prevIncome.sellingExp + prevIncome.financeExp + (prevIncome.rdExp || 0)) : null
        ),
        expenseChangeVsSameYear: calcChange(
          totalExpenses,
          sameLastYearIncome ? (sameLastYearIncome.adminExp + sameLastYearIncome.sellingExp + sameLastYearIncome.financeExp + (sameLastYearIncome.rdExp || 0)) : null
        ),
      },
      solvency: {
        totalAssets,
        totalLiabilities,
        totalEquity: totalAssets - totalLiabilities,
        debtRatio: totalAssets !== 0 ? totalLiabilities / totalAssets : 0,
        currentRatio,
        quickRatio,
        cashRatio,
      },
      trend: trendData,
    }
  }

  private getCashFlow(periodId: string, direction: string): number {
    const db = getDb()
    const result = db.prepare(`
      SELECT COALESCE(SUM(vl.amount), 0) as total
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE (vl.account_code LIKE '1001%' OR vl.account_code LIKE '1002%')
        AND vl.direction = ? AND v.period_id = ? AND v.status = 'posted'
    `).get(direction, periodId) as { total: number }
    return result.total / 100
  }
}
