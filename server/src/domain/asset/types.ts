export type DepreciationMethod = 'straight_line' | 'workload' | 'accelerated'
export type AssetStatus = 'active' | 'disposed' | 'transferred'

export interface Asset {
  id: string
  assetNo: string         // 资产编号
  name: string
  category: string        // 资产分类
  originalValue: number   // 原值（分）
  salvageRate: number     // 残值率（0-1）
  usefulLife: number      // 预计使用年限（月）
  depreciationMethod: DepreciationMethod
  acquiredDate: string    // 取得日期
  startDeprecDate: string // 开始折旧日期
  departmentId: string | null
  location: string | null
  accountCode: string     // 资产科目
  deprAccountCode: string // 累计折旧科目
  expenseAccountCode: string // 折旧费用科目
  status: AssetStatus
  barcode: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface AssetDepreciation {
  id: string
  assetId: string
  periodId: string
  depreciationAmount: number  // 本期折旧额（分）
  accumulatedDepreciation: number // 累计折旧（分）
  netValue: number            // 净值（分）
  voucherId: string | null    // 对应凭证
  createdAt: string
}
