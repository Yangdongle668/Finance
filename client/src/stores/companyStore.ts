import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Company {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface CompanyState {
  companies: Company[]
  currentCompany: Company | null
  setCompanies: (companies: Company[]) => void
  setCurrentCompany: (company: Company | null) => void
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      companies: [],
      currentCompany: null,
      setCompanies: (companies) => set({ companies }),
      setCurrentCompany: (company) => set({ currentCompany: company }),
    }),
    { name: 'company-storage' }
  )
)
