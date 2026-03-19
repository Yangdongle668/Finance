import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Dropdown, Avatar, Select, Space, Typography, Tag, Tooltip } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, BookOutlined, BarChartOutlined,
  BankOutlined, AuditOutlined, SettingOutlined,
  UserOutlined, LogoutOutlined, LockOutlined, AppstoreOutlined,
  ReconciliationOutlined, SwapOutlined, EditOutlined, FormOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { usePeriodStore } from '@/stores/periodStore'
import { api } from '@/api/client'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表板' },
  // ① 录入凭证
  {
    key: 'voucher-entry', icon: <FormOutlined />, label: '凭证录入',
    children: [
      { key: '/vouchers/new', label: '录凭证' },
      { key: '/voucher/attachment-manage', label: '原始凭证管理' },
    ]
  },
  // ② 审核凭证
  {
    key: 'voucher-review', icon: <AuditOutlined />, label: '凭证审核',
    children: [
      { key: '/vouchers', label: '凭证列表' },
      { key: '/vouchers/summary', label: '凭证汇总表' },
    ]
  },
  // ③④ 过账 / 明细账
  {
    key: 'ledger', icon: <BookOutlined />, label: '账簿查询',
    children: [
      { key: '/ledger/trial-balance', label: '科目余额表' },
      { key: '/ledger/detail', label: '明细账' },
      { key: '/ledger/general', label: '总账' },
    ]
  },
  // ④ 固定资产（折旧计提）
  { key: '/assets', icon: <AppstoreOutlined />, label: '固定资产' },
  // ⑤ 期末结账
  { key: '/closing', icon: <ReconciliationOutlined />, label: '期末结账' },
  // ⑥ 财务报表
  {
    key: 'reports', icon: <BarChartOutlined />, label: '财务报表',
    children: [
      { key: '/reports/balance-sheet', label: '资产负债表' },
      { key: '/reports/income-statement', label: '利润表' },
    ]
  },
  { key: '/invoices', icon: <FileTextOutlined />, label: '发票管理' },
  {
    key: 'settings', icon: <SettingOutlined />, label: '系统设置',
    children: [
      { key: '/settings/accounts', label: '科目设置' },
      { key: '/settings/periods', label: '期间管理' },
      { key: '/settings/company', label: '账套管理' },
      { key: '/settings/users', label: '用户管理' },
    ]
  },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, companies, currentCompanyId, getCurrentCompany, logout } = useAuthStore()
  const { periods, currentPeriod, setPeriods, setCurrentPeriod, resetPeriods } = usePeriodStore()
  const [collapsed, setCollapsed] = useState(false)

  const currentCompany = getCurrentCompany()

  useEffect(() => {
    if (!currentCompanyId) return
    resetPeriods()
    api.listPeriods().then(r => {
      const ps = r.data.data
      setPeriods(ps)
      if (ps.length > 0) {
        const open = ps.filter(p => p.status === 'open')
        setCurrentPeriod(open[0] ?? ps[0])
      }
    })
  }, [currentCompanyId])

  const selectedKeys = [location.pathname]
  const openKeys = menuItems
    .filter(m => m.children?.some(c => location.pathname.startsWith(c.key)))
    .map(m => m.key)

  const userMenu = [
    { key: 'profile', icon: <EditOutlined />, label: '个人信息' },
    { key: 'pwd', icon: <LockOutlined />, label: '修改密码' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ]

  const handleUserMenu = ({ key }: { key: string }) => {
    if (key === 'logout') { logout(); navigate('/login') }
    else if (key === 'switch') { navigate('/select-company') }
    else if (key === 'profile') { navigate('/settings/profile') }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0', boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}
        width={220}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0', padding: '0 16px' }}>
          <BankOutlined style={{ fontSize: 24, color: '#1677ff', marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && <Text strong style={{ fontSize: 16, color: '#1677ff' }}>乐算云</Text>}
        </div>

        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          style={{ borderRight: 'none', marginTop: 8 }}
          onClick={({ key }) => { if (!key.includes('/')) return; navigate(key) }}
        />
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
          <Space size={16}>
            {currentCompany && (
              <Tooltip title="切换账套">
                <Tag
                  color="blue"
                  style={{ fontSize: 13, padding: '2px 8px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => navigate('/select-company')}
                >
                  <BankOutlined style={{ marginRight: 4 }} />
                  {currentCompany.name}
                  <SwapOutlined style={{ marginLeft: 6, fontSize: 11, opacity: 0.75 }} />
                </Tag>
              </Tooltip>
            )}
            <Text type="secondary" style={{ fontSize: 13 }}>当前期间</Text>
            <Select
              value={currentPeriod?.id}
              onChange={id => setCurrentPeriod(periods.find(p => p.id === id)!)}
              style={{ width: 160 }}
              size="small"
              options={periods.map(p => ({
                value: p.id,
                label: (
                  <Space size={4}>
                    {p.name}
                    {p.status === 'closed' && <Tag color="red" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>已结账</Tag>}
                    {p.status === 'open' && <Tag color="green" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>开放</Tag>}
                  </Space>
                ),
              }))}
            />
          </Space>

          {/* 用户菜单 */}
          <Dropdown menu={{ items: userMenu, onClick: handleUserMenu }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
              <Text style={{ fontSize: 14 }}>{user?.name}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ padding: '24px', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
