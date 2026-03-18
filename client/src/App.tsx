import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/pages/LoginPage'
import SelectCompanyPage from '@/pages/SelectCompanyPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import VoucherListPage from '@/pages/voucher/VoucherListPage'
import VoucherFormPage from '@/pages/voucher/VoucherFormPage'
import VoucherDetailPage from '@/pages/voucher/VoucherDetailPage'
import AttachmentManagePage from '@/pages/voucher/AttachmentManagePage'
import VoucherSummaryPage from '@/pages/voucher/VoucherSummaryPage'
import TrialBalancePage from '@/pages/ledger/TrialBalancePage'
import LedgerDetailPage from '@/pages/ledger/LedgerDetailPage'
import GeneralLedgerPage from '@/pages/ledger/GeneralLedgerPage'
import BalanceSheetPage from '@/pages/reports/BalanceSheetPage'
import IncomeStatementPage from '@/pages/reports/IncomeStatementPage'
import AccountsPage from '@/pages/settings/AccountsPage'
import PeriodPage from '@/pages/settings/PeriodPage'
import AssetPage from '@/pages/asset/AssetPage'
import InvoicePage from '@/pages/invoice/InvoicePage'
import ClosingPage from '@/pages/closing/ClosingPage'
import ProfilePage from '@/pages/settings/ProfilePage'
import UserManagePage from '@/pages/settings/UserManagePage'
import CompanySettingsPage from '@/pages/settings/CompanySettingsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn())
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireCompany({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn())
  const companyId = useAuthStore(s => s.currentCompanyId) || localStorage.getItem('companyId')
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!companyId) return <Navigate to="/select-company" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/select-company" element={<RequireAuth><SelectCompanyPage /></RequireAuth>} />
        <Route path="/" element={<RequireCompany><MainLayout /></RequireCompany>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {/* 凭证 */}
          <Route path="vouchers" element={<VoucherListPage />} />
          <Route path="vouchers/new" element={<VoucherFormPage />} />
          <Route path="vouchers/:id" element={<VoucherDetailPage />} />
          <Route path="vouchers/:id/edit" element={<VoucherFormPage />} />
          <Route path="vouchers/summary" element={<VoucherSummaryPage />} />
          <Route path="voucher/attachment-manage" element={<AttachmentManagePage />} />
          {/* 账簿 */}
          <Route path="ledger/trial-balance" element={<TrialBalancePage />} />
          <Route path="ledger/detail" element={<LedgerDetailPage />} />
          <Route path="ledger/general" element={<GeneralLedgerPage />} />
          {/* 报表 */}
          <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="reports/income-statement" element={<IncomeStatementPage />} />
          {/* 结账 */}
          <Route path="closing" element={<ClosingPage />} />
          {/* 资产 */}
          <Route path="assets" element={<AssetPage />} />
          {/* 发票 */}
          <Route path="invoices" element={<InvoicePage />} />
          {/* 设置 */}
          <Route path="settings/accounts" element={<AccountsPage />} />
          <Route path="settings/periods" element={<PeriodPage />} />
          <Route path="settings/profile" element={<ProfilePage />} />
          <Route path="settings/users" element={<UserManagePage />} />
          <Route path="settings/company" element={<CompanySettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
