import { useEffect, useState } from 'react'
import { Table, Card, Typography, Space, Switch, Tag, Input, Select, Button, Modal, Form, Popconfirm, message, Tooltip } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import { api, type Account } from '@/api/client'
import ModuleTabBar from '@/components/layout/ModuleTabBar'

const SETTINGS_TABS = [
  { key: 'accounts', label: '科目设置', path: '/settings/accounts' },
  { key: 'periods', label: '期间管理', path: '/settings/periods' },
  { key: 'company', label: '账套管理', path: '/settings/company' },
  { key: 'users', label: '用户管理', path: '/settings/users' },
]

const { Title, Text } = Typography

const NATURE_COLORS: Record<string, string> = {
  asset: 'blue', liability: 'orange', equity: 'purple', income: 'green', expense: 'red'
}
const NATURE_LABELS: Record<string, string> = {
  asset: '资产', liability: '负债', equity: '权益', income: '收入', expense: '费用'
}
// Default direction by nature
const NATURE_DIRECTION: Record<string, string> = {
  asset: 'debit', liability: 'credit', equity: 'credit', income: 'credit', expense: 'debit'
}

interface AccountFormValues {
  code: string
  name: string
  parentCode?: string
  nature: string
  direction: string
  remark?: string
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [nature, setNature] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)
  const [addForm] = Form.useForm<AccountFormValues>()
  const [editForm] = Form.useForm<Partial<AccountFormValues>>()

  const loadAccounts = () => {
    setLoading(true)
    api.listAccounts().then(r => setAccounts(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { loadAccounts() }, [])

  const filtered = accounts.filter(a => {
    const kw = keyword.toLowerCase()
    const matchKw = !kw || a.code.includes(kw) || a.name.toLowerCase().includes(kw)
    const matchNature = !nature || a.nature === nature
    return matchKw && matchNature
  })

  const handleToggle = async (code: string, checked: boolean) => {
    await api.updateAccount(code, { isEnabled: checked })
    setAccounts(prev => prev.map(a => a.code === code ? { ...a, isEnabled: checked } : a))
  }

  const handleAddSubmit = async () => {
    const vals = await addForm.validateFields()
    setSaving(true)
    try {
      // Determine level from parent
      const parent = vals.parentCode ? accounts.find(a => a.code === vals.parentCode) : null
      const level = parent ? parent.level + 1 : 1
      await api.createAccount({
        code: vals.code,
        name: vals.name,
        nature: vals.nature as Account['nature'],
        direction: vals.direction as Account['direction'],
        parentCode: vals.parentCode || undefined,
        level,
        isLeaf: true, // New accounts are leaf by default
        isEnabled: true,
        remark: vals.remark,
      })
      // If it has a parent, mark parent as non-leaf
      if (vals.parentCode) {
        await api.updateAccount(vals.parentCode, { isLeaf: false })
      }
      message.success('科目创建成功')
      addForm.resetFields()
      setAddOpen(false)
      loadAccounts()
    } finally {
      setSaving(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!editTarget) return
    const vals = await editForm.validateFields()
    setSaving(true)
    try {
      await api.updateAccount(editTarget.code, {
        name: vals.name,
        direction: vals.direction as Account['direction'],
        remark: vals.remark,
      })
      message.success('科目更新成功')
      setEditTarget(null)
      loadAccounts()
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (account: Account) => {
    setEditTarget(account)
    editForm.setFieldsValue({ name: account.name, direction: account.direction, remark: account.remark ?? '' })
  }

  // When nature changes in add form, auto-fill direction
  const handleNatureChange = (val: string) => {
    addForm.setFieldValue('direction', NATURE_DIRECTION[val] || 'debit')
  }

  const columns = [
    {
      title: '科目代码', dataIndex: 'code', width: 140,
      render: (v: string, r: Account) => (
        <Text style={{ paddingLeft: (r.level - 1) * 16, fontFamily: 'monospace', fontWeight: r.level === 1 ? 600 : 400 }}>{v}</Text>
      ),
    },
    { title: '科目名称', dataIndex: 'name' },
    { title: '级次', dataIndex: 'level', width: 60, align: 'center' as const },
    {
      title: '性质', dataIndex: 'nature', width: 80,
      render: (v: string) => <Tag color={NATURE_COLORS[v]}>{NATURE_LABELS[v]}</Tag>,
    },
    {
      title: '方向', dataIndex: 'direction', width: 80,
      render: (v: string) => v === 'debit' ? <Text style={{ color: '#cf1322' }}>借</Text> : <Text style={{ color: '#1677ff' }}>贷</Text>,
    },
    {
      title: '末级', dataIndex: 'isLeaf', width: 70, align: 'center' as const,
      render: (v: boolean) => v ? <Tag color="blue">末级</Tag> : <Tag color="default">上级</Tag>,
    },
    {
      title: '状态', dataIndex: 'isEnabled', width: 80,
      render: (v: boolean, r: Account) => (
        <Switch checked={v} size="small" onChange={checked => handleToggle(r.code, checked)} />
      ),
    },
    {
      title: '操作', width: 70, align: 'center' as const,
      render: (_: unknown, r: Account) => (
        <Tooltip title="编辑">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <>
    <ModuleTabBar tabs={SETTINGS_TABS} />
    <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>科目设置</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>新增科目</Button>
      </div>

      <Card size="small">
        <Space>
          <Input placeholder="搜索科目代码/名称" prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
          <Select placeholder="科目性质" style={{ width: 120 }} allowClear value={nature || undefined}
            onChange={v => setNature(v ?? '')}>
            {Object.entries(NATURE_LABELS).map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
          </Select>
          <Text type="secondary">共 {filtered.length} 个科目</Text>
        </Space>
      </Card>

      <Table
        rowKey="code"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        rowClassName={r => r.level === 1 ? 'font-weight-bold' : ''}
      />

      {/* Add account modal */}
      <Modal
        title="新增科目"
        open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields() }}
        onOk={handleAddSubmit}
        confirmLoading={saving}
        okText="创建"
        width={520}
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="科目代码" rules={[
            { required: true, message: '请输入科目代码' },
            { pattern: /^\d+$/, message: '科目代码只能是数字' },
            {
              validator: (_, v) => {
                if (accounts.find(a => a.code === v)) return Promise.reject('该科目代码已存在')
                return Promise.resolve()
              }
            }
          ]}>
            <Input placeholder="如: 660205" />
          </Form.Item>
          <Form.Item name="name" label="科目名称" rules={[{ required: true, message: '请输入科目名称' }]}>
            <Input placeholder="如: 招待费" />
          </Form.Item>
          <Form.Item name="parentCode" label="上级科目（可选）">
            <Select
              showSearch
              allowClear
              placeholder="选择上级科目（为空则新增一级科目）"
              optionFilterProp="label"
              options={accounts.filter(a => !a.isLeaf || a.level < 4).map(a => ({
                value: a.code,
                label: `${'　'.repeat(a.level - 1)}${a.code} ${a.name}`,
              }))}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="nature" label="科目性质" rules={[{ required: true, message: '请选择性质' }]} style={{ flex: 1 }}>
              <Select onChange={handleNatureChange} options={Object.entries(NATURE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </Form.Item>
            <Form.Item name="direction" label="余额方向" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={[{ value: 'debit', label: '借方' }, { value: 'credit', label: '贷方' }]} />
            </Form.Item>
          </Space>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit account modal */}
      <Modal
        title={`编辑科目: ${editTarget?.code} ${editTarget?.name}`}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={handleEditSubmit}
        confirmLoading={saving}
        okText="保存"
        width={480}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="科目代码">
            <Input value={editTarget?.code} disabled />
          </Form.Item>
          <Form.Item name="name" label="科目名称" rules={[{ required: true, message: '请输入科目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="direction" label="余额方向" rules={[{ required: true }]}>
            <Select options={[{ value: 'debit', label: '借方' }, { value: 'credit', label: '贷方' }]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
    </>
  )
}
