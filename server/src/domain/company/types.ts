export interface Company {
  id: string
  name: string
  taxNo: string | null
  legalPerson: string | null
  industry: string | null
  address: string | null
  phone: string | null
  fiscalYearStart: number          // 财年起始月 1–12
  accountingStandard: 'small' | 'general'  // 小企业准则 | 一般准则
  currency: string                 // 记账本位币，默认 CNY
  createdAt: string
  updatedAt: string
}
