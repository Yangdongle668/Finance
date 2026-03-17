export type EmployeeStatus = 'active' | 'resigned'

export interface Employee {
  id: string
  employeeNo: string
  name: string
  idCard: string | null
  joinDate: string
  departmentId: string | null
  baseSalary: number      // 基本工资（分）
  salaryType: 'monthly' | 'hourly'
  status: EmployeeStatus
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface PayrollItem {
  id: string
  payrollId: string
  employeeId: string
  employeeName: string
  baseSalary: number
  performanceBonus: number
  allowances: number
  socialInsurance: number  // 社保个人部分（分）
  housingFund: number      // 公积金个人部分（分）
  incomeTax: number        // 个人所得税（分）
  otherDeductions: number
  netSalary: number        // 实发工资（分）
}

export interface Payroll {
  id: string
  periodId: string
  status: 'draft' | 'confirmed' | 'paid'
  totalGross: number       // 应发合计（分）
  totalDeductions: number  // 扣款合计（分）
  totalNet: number         // 实发合计（分）
  voucherId: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
  items?: PayrollItem[]
}
