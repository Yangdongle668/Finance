import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/pages/LoginPage'
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn())
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
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
          {/* 资产 */}
          <Route path="assets" element={<AssetPage />} />
          {/* 发票 */}
          <Route path="invoices" element={<InvoicePage />} />
          {/* 设置 */}
          <Route path="settings/accounts" element={<AccountsPage />} />
          <Route path="settings/periods" element={<PeriodPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
