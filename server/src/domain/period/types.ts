/** 期间状态 */
export type PeriodStatus = 'open' | 'closing' | 'closed'

/** 会计期间 */
export interface Period {
  id: string
  year: number
  month: number           // 1-12
  name: string            // e.g. "2024年01月"
  startDate: string       // YYYY-MM-DD
  endDate: string         // YYYY-MM-DD
  status: PeriodStatus
  closedAt: string | null
  closedBy: string | null
  createdAt: string
  updatedAt: string
}
