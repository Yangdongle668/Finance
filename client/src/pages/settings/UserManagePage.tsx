import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { api, type CompanyUser } from '@/api/client'
import ModuleTabBar from '@/components/layout/ModuleTabBar'

const SETTINGS_TABS = [
  { key: 'accounts', label: '科目设置', path: '/settings/accounts' },
  { key: 'periods', label: '期间管理', path: '/settings/periods' },
  { key: 'company', label: '账套管理', path: '/settings/company' },
  { key: 'users', label: '用户管理', path: '/settings/users' },
]

const { Title } = Typography

const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'supervisor', label: '主管' },
  { value: 'accountant', label: '会计' },
  { value: 'cashier', label: '出纳' },
  { value: 'viewer', label: '查看者' },
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'red', supervisor: 'orange', accountant: 'blue', cashier: 'green', viewer: 'default',
}

export default function UserManagePage() {
  const { currentCompanyId, getCurrentRole } = useAuthStore()
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(false)

  // Add existing user modal
  const [addOpen, setAddOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; username: string; name: string }[]>([])
  const [addForm] = Form.useForm()

  // Create new user modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [creating, setCreating] = useState(false)

  const isAdmin = getCurrentRole() === 'admin'

  const loadUsers = async () => {
    if (!currentCompanyId) return
    setLoading(true)
    try {
      const res = await api.listCompanyUsers(currentCompanyId)
      setUsers(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [currentCompanyId])

  const handleAdd = async () => {
    const values = await addForm.validateFields()
    await api.addCompanyUser(currentCompanyId!, values)
    message.success('用户已添加')
    setAddOpen(false)
    addForm.resetFields()
    loadUsers()
  }

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    setCreating(true)
    try {
      const res = await api.createUser({
        username: values.username,
        password: values.password,
        name: values.name,
        email: values.email || undefined,
      })
      const newUserId = res.data.data.id
      await api.addCompanyUser(currentCompanyId!, { userId: newUserId, role: values.role })
      message.success('用户已创建并加入账套')
      setCreateOpen(false)
      createForm.resetFields()
      loadUsers()
    } catch {
      // handled by interceptor
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    await api.updateCompanyUser(currentCompanyId!, userId, { role })
    message.success('角色已更新')
    loadUsers()
  }

  const handleRemove = async (userId: string) => {
    await api.removeCompanyUser(currentCompanyId!, userId)
    message.success('用户已移除')
    loadUsers()
  }

  const openAddModal = async () => {
    const res = await api.listUsers()
    setAllUsers(res.data.data)
    setAddOpen(true)
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色', dataIndex: 'role', key: 'role',
      render: (role: string, record: CompanyUser) => isAdmin ? (
        <Select size="small" value={role} onChange={v => handleRoleChange(record.id, v)} style={{ width: 100 }} options={ROLE_OPTIONS} />
      ) : (
        <Tag color={ROLE_COLORS[role]}>{ROLE_OPTIONS.find(r => r.value === role)?.label || role}</Tag>
      ),
    },
    {
      title: '状态', dataIndex: 'isEnabled', key: 'isEnabled',
      render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    ...(isAdmin ? [{
      title: '操作', key: 'action',
      render: (_: unknown, record: CompanyUser) => (
        <Popconfirm title="确定移除该用户？" onConfirm={() => handleRemove(record.id)}>
          <Button type="link" danger size="small">移除</Button>
        </Popconfirm>
      ),
    }] : []),
  ]

  return (
    <>
    <ModuleTabBar tabs={SETTINGS_TABS} />
    <Card style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        {isAdmin && (
          <Space>
            <Button icon={<PlusOutlined />} onClick={openAddModal}>添加已有用户</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setCreateOpen(true)}>新建用户</Button>
          </Space>
        )}
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} pagination={false} />

      {/* Add existing user modal */}
      <Modal title="添加已有用户到账套" open={addOpen} onCancel={() => setAddOpen(false)} onOk={handleAdd} okText="添加">
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="userId" label="选择用户" rules={[{ required: true, message: '请选择用户' }]}>
            <Select
              showSearch
              placeholder="搜索用户"
              optionFilterProp="label"
              options={allUsers
                .filter(u => !users.some(cu => cu.id === u.id))
                .map(u => ({ value: u.id, label: `${u.name} (${u.username})` }))}
            />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="accountant">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create new user modal */}
      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields() }}
        onOk={handleCreate}
        okText="创建并加入账套"
        confirmLoading={creating}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少3个字符' }]}>
            <Input placeholder="用于登录的账号" autoComplete="off" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="显示名称" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="可选" type="email" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6位' }]}>
            <Input.Password placeholder="至少6位" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认密码" rules={[{ required: true, message: '请再次输入密码' }]}>
            <Input.Password placeholder="再次输入密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="accountant">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
    </>
  )
}
