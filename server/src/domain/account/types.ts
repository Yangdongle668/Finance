/** 科目性质 */
export type AccountNature = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

/** 余额方向 */
export type BalanceDirection = 'debit' | 'credit'

/** 科目实体 */
export interface Account {
  code: string           // 科目代码（主键）
  name: string           // 科目名称
  level: number          // 科目级次 1-4
  nature: AccountNature  // 科目性质
  direction: BalanceDirection // 记账方向（正常余额方向）
  parentCode: string | null  // 上级科目代码
  isLeaf: boolean        // 是否末级科目（只有末级才能挂凭证行）
  isEnabled: boolean     // 是否启用
  hasCostCenter: boolean // 是否需要核算部门
  hasProject: boolean    // 是否需要核算项目
  hasCustomer: boolean   // 是否需要核算客户
  hasSupplier: boolean   // 是否需要核算供应商
  remark: string | null
  createdAt: string
  updatedAt: string
}

/** 科目余额（按期间） */
export interface AccountBalance {
  id: string
  accountCode: string
  periodId: string
  openingDebit: number   // 期初借方余额
  openingCredit: number  // 期初贷方余额
  debitAmount: number    // 本期借方发生额
  creditAmount: number   // 本期贷方发生额
  closingDebit: number   // 期末借方余额
  closingCredit: number  // 期末贷方余额
}

/** 核算项目类型 */
export type DimensionType = 'department' | 'project' | 'customer' | 'supplier' | 'custom'

/** 核算项目 */
export interface Dimension {
  id: string
  type: DimensionType
  code: string
  name: string
  parentId: string | null
  isEnabled: boolean
  remark: string | null
  createdAt: string
  updatedAt: string
}
