import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { api, type CompanyUser } from '@/api/client'

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
  const [addOpen, setAddOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; username: string; name: string }[]>([])
  const [form] = Form.useForm()
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
    const values = await form.validateFields()
    await api.addCompanyUser(currentCompanyId!, values)
    message.success('用户已添加')
    setAddOpen(false)
    form.resetFields()
    loadUsers()
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
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>添加用户</Button>}
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} pagination={false} />

      <Modal title="添加用户到账套" open={addOpen} onCancel={() => setAddOpen(false)} onOk={handleAdd} okText="添加">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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
    </Card>
  )
}
