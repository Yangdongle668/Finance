import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Dropdown, Avatar, Select, Space, Typography, Tag, Modal, Form, Input, message, Button, Tooltip } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, BookOutlined, BarChartOutlined,
  BankOutlined, AuditOutlined, SettingOutlined,
  UserOutlined, LogoutOutlined, LockOutlined, AppstoreOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { usePeriodStore } from '@/stores/periodStore'
import { useCompanyStore } from '@/stores/companyStore'
import { api } from '@/api/client'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表板' },
  { key: '/vouchers', icon: <FileTextOutlined />, label: '凭证管理' },
  {
    key: 'ledger', icon: <BookOutlined />, label: '账簿',
    children: [
      { key: '/ledger/trial-balance', label: '科目余额表' },
      { key: '/ledger/detail', label: '明细账' },
      { key: '/ledger/general', label: '总账' },
    ]
  },
  {
    key: 'reports', icon: <BarChartOutlined />, label: '财务报表',
    children: [
      { key: '/reports/balance-sheet', label: '资产负债表' },
      { key: '/reports/income-statement', label: '利润表' },
    ]
  },
  { key: '/assets', icon: <AppstoreOutlined />, label: '固定资产' },
  { key: '/invoices', icon: <AuditOutlined />, label: '发票管理' },
  {
    key: 'settings', icon: <SettingOutlined />, label: '系统设置',
    children: [
      { key: '/settings/accounts', label: '科目设置' },
      { key: '/settings/periods', label: '期间管理' },
    ]
  },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { periods, currentPeriod, setPeriods, setCurrentPeriod } = usePeriodStore()
  const { currentCompany, setCurrentCompany } = useCompanyStore()
  const [collapsed, setCollapsed] = useState(false)
  const [pwdVisible, setPwdVisible] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdForm] = Form.useForm()

  useEffect(() => {
    api.listPeriods().then(r => {
      const ps = r.data.data
      setPeriods(ps)
      if (!currentPeriod && ps.length > 0) {
        const open = ps.filter(p => p.status === 'open')
        setCurrentPeriod(open[0] ?? ps[0])
      }
    })
  }, [currentCompany?.id])

  const selectedKeys = [location.pathname]
  const openKeys = menuItems
    .filter(m => m.children?.some(c => location.pathname.startsWith(c.key)))
    .map(m => m.key)

  const handleChangePwd = async () => {
    const values = await pwdForm.validateFields()
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }
    setPwdLoading(true)
    try {
      await api.changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword })
      message.success('密码修改成功，请重新登录')
      setPwdVisible(false)
      pwdForm.resetFields()
      logout()
      navigate('/login')
    } catch {
      // error handled by axios interceptor
    } finally {
      setPwdLoading(false)
    }
  }

  const handleSwitchCompany = () => {
    setCurrentCompany(null)
    setPeriods([])
    setCurrentPeriod(null as never)
    navigate('/companies')
  }

  const userMenu = [
    { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
    { key: 'pwd', icon: <LockOutlined />, label: '修改密码' },
    { type: 'divider' as const },
    { key: 'switch', icon: <SwapOutlined />, label: '切换账套' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ]

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
          {!collapsed && <Text strong style={{ fontSize: 16, color: '#1677ff' }}>乐算云会计</Text>}
        </div>

        {/* Company name */}
        {!collapsed && currentCompany && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Tooltip title="点击切换账套">
              <div
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={handleSwitchCompany}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <BankOutlined style={{ fontSize: 14, color: '#fff' }} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Text strong ellipsis style={{ fontSize: 13, display: 'block' }}>
                    {currentCompany.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <SwapOutlined /> 切换账套
                  </Text>
                </div>
              </div>
            </Tooltip>
          </div>
        )}

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
          {/* Company name + period selector */}
          <Space size={16}>
            {currentCompany && (
              <Text strong style={{ fontSize: 14 }}>{currentCompany.name}</Text>
            )}
            <div style={{ width: 1, height: 20, background: '#e8e8e8' }} />
            <Space>
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
          </Space>

          {/* User menu */}
          <Dropdown menu={{
            items: userMenu,
            onClick: ({ key }) => {
              if (key === 'logout') { logout(); navigate('/login') }
              if (key === 'pwd') { setPwdVisible(true) }
              if (key === 'switch') { handleSwitchCompany() }
            }
          }}>
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

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={pwdVisible}
        onOk={handleChangePwd}
        confirmLoading={pwdLoading}
        onCancel={() => { setPwdVisible(false); pwdForm.resetFields() }}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少6位' },
          ]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" rules={[
            { required: true, message: '请确认新密码' },
          ]}>
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
