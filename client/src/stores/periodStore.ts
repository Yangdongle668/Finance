import { create } from 'zustand'
import type { Period } from '@/api/client'

interface PeriodState {
  periods: Period[]
  currentPeriod: Period | null
  setPeriods: (periods: Period[]) => void
  setCurrentPeriod: (period: Period) => void
}

export const usePeriodStore = create<PeriodState>(set => ({
  periods: [],
  currentPeriod: null,
  setPeriods: periods => set({ periods }),
  setCurrentPeriod: period => set({ currentPeriod: period }),
}))
