export type InvoiceDirection = 'input' | 'output'  // 进项 | 销项
export type InvoiceType = 'vat_special' | 'vat_general' | 'receipt' | 'other'
export type InvoiceStatus = 'pending' | 'certified' | 'deducted' | 'voided'

export interface Invoice {
  id: string
  direction: InvoiceDirection
  invoiceType: InvoiceType
  invoiceNo: string
  invoiceCode: string | null
  invoiceDate: string
  sellerName: string
  sellerTaxNo: string | null
  buyerName: string
  buyerTaxNo: string | null
  amountExTax: number     // 不含税金额（分）
  taxRate: number         // 税率（0-1）
  taxAmount: number       // 税额（分）
  totalAmount: number     // 价税合计（分）
  status: InvoiceStatus
  voucherId: string | null
  certifiedDate: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}
