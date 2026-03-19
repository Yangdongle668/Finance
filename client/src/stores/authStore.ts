import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/api/client'

export interface CompanyInfo {
  id: string
  name: string
  role: string
  permissions: string[] | null
}

interface AuthState {
  token: string | null
  user: User | null
  companies: CompanyInfo[]
  currentCompanyId: string | null
  setAuth: (token: string, user: User, companies?: CompanyInfo[]) => void
  setCompanies: (companies: CompanyInfo[]) => void
  setCurrentCompany: (companyId: string) => void
  updateUser: (user: Partial<User>) => void
  logout: () => void
  isLoggedIn: () => boolean
  getCurrentCompany: () => CompanyInfo | undefined
  getCurrentRole: () => string
  hasPermission: (perm: string) => boolean
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  supervisor: [
    'voucher:view', 'voucher:create', 'voucher:edit', 'voucher:delete', 'voucher:review', 'voucher:post',
    'account:view', 'account:create', 'account:edit',
    'report:view', 'report:export',
    'period:view', 'period:close', 'period:reopen',
    'asset:view', 'asset:create', 'asset:edit', 'asset:depreciate',
    'invoice:view', 'invoice:create', 'invoice:edit',
    'closing:view', 'closing:execute',
    'attachment:view', 'attachment:upload',
    'user:view',
  ],
  accountant: [
    'voucher:view', 'voucher:create', 'voucher:edit',
    'account:view',
    'report:view',
    'period:view',
    'asset:view', 'asset:create', 'asset:edit', 'asset:depreciate',
    'invoice:view', 'invoice:create', 'invoice:edit',
    'closing:view', 'closing:execute',
    'attachment:view', 'attachment:upload',
  ],
  cashier: [
    'voucher:view', 'voucher:create',
    'account:view',
    'report:view',
    'period:view',
    'invoice:view',
    'attachment:view', 'attachment:upload',
  ],
  viewer: [
    'voucher:view', 'account:view', 'report:view', 'period:view',
    'asset:view', 'invoice:view', 'closing:view', 'attachment:view',
  ],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      companies: [],
      currentCompanyId: null,
      setAuth: (token, user, companies) => {
        localStorage.setItem('token', token)
        localStorage.removeItem('companyId')
        set({ token, user, companies: companies || [], currentCompanyId: null })
      },
      setCompanies: (companies) => set({ companies }),
      setCurrentCompany: (companyId) => {
        localStorage.setItem('companyId', companyId)
        set({ currentCompanyId: companyId })
      },
      updateUser: (partial) => {
        const user = get().user
        if (user) set({ user: { ...user, ...partial } })
      },
      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('companyId')
        set({ token: null, user: null, companies: [], currentCompanyId: null })
      },
      isLoggedIn: () => !!get().token,
      getCurrentCompany: () => {
        const { companies, currentCompanyId } = get()
        return companies.find(c => c.id === currentCompanyId)
      },
      getCurrentRole: () => {
        const company = get().getCurrentCompany()
        return company?.role || 'viewer'
      },
      hasPermission: (perm: string) => {
        const company = get().getCurrentCompany()
        if (!company) return false

        // Check explicit permission overrides first
        if (company.permissions?.includes(perm)) return true

        // Check role-based permissions
        const rolePerms = ROLE_PERMISSIONS[company.role] || []
        if (rolePerms.includes('*')) return true
        return rolePerms.includes(perm)
      },
    }),
    { name: 'auth-storage' }
  )
)
