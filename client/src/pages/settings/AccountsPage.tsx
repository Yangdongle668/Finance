import { useEffect, useState } from 'react'
import { Table, Card, Typography, Space, Switch, Tag, Input, Select, Button, Modal, Form, message, Popconfirm } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { api, type Account } from '@/api/client'

const { Title, Text } = Typography

const NATURE_COLORS: Record<string, string> = {
  asset: 'blue', liability: 'orange', equity: 'purple', income: 'green', expense: 'red'
}
const NATURE_LABELS: Record<string, string> = {
  asset: '资产', liability: '负债', equity: '权益', income: '收入', expense: '费用'
}
const DIRECTION_MAP: Record<string, string> = {
  asset: 'debit', liability: 'credit', equity: 'credit', income: 'credit', expense: 'debit'
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [nature, setNature] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form] = Form.useForm()

  const refresh = () => {
    setLoading(true)
    api.listAccounts().then(r => setAccounts(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const filtered = accounts.filter(a => {
    const kw = keyword.toLowerCase()
    const matchKw = !kw || a.code.includes(kw) || a.name.toLowerCase().includes(kw)
    const matchNature = !nature || a.nature === nature
    return matchKw && matchNature
  })

  const openCreate = () => {
    setEditingAccount(null)
    form.resetFields()
    form.setFieldsValue({ isLeaf: true, isEnabled: true })
    setShowForm(true)
  }

  const openEdit = (record: Account) => {
    setEditingAccount(record)
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      nature: record.nature,
      parentCode: record.parentCode || undefined,
      isLeaf: record.isLeaf,
      isEnabled: record.isEnabled,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (editingAccount) {
      await api.updateAccount(editingAccount.code, {
        name: values.name,
        isLeaf: values.isLeaf,
        isEnabled: values.isEnabled,
      })
      message.success('科目更新成功')
    } else {
      const parentCode = values.parentCode
      let level = 1
      let direction = DIRECTION_MAP[values.nature] || 'debit'
      if (parentCode) {
        const parent = accounts.find(a => a.code === parentCode)
        if (parent) {
          level = parent.level + 1
          direction = parent.direction
        }
      }
      await api.createAccount({
        code: values.code,
        name: values.name,
        level,
        nature: values.nature,
        direction,
        parentCode: parentCode || null,
        isLeaf: values.isLeaf ?? true,
        isEnabled: values.isEnabled ?? true,
      } as Account)
      message.success('科目创建成功')
    }
    setShowForm(false)
    form.resetFields()
    refresh()
  }

  const handleDelete = async (code: string) => {
    try {
      await api.deleteAccount(code)
      message.success('科目删除成功')
      refresh()
    } catch {
      // error handled by interceptor
    }
  }

  const columns = [
    { title: '科目代码', dataIndex: 'code', width: 120, render: (v: string, r: Account) => <Text style={{ paddingLeft: (r.level - 1) * 16, fontFamily: 'monospace' }}>{v}</Text> },
    { title: '科目名称', dataIndex: 'name' },
    { title: '级次', dataIndex: 'level', width: 60, align: 'center' as const },
    { title: '性质', dataIndex: 'nature', width: 80, render: (v: string) => <Tag color={NATURE_COLORS[v]}>{NATURE_LABELS[v]}</Tag> },
    { title: '方向', dataIndex: 'direction', width: 80, render: (v: string) => v === 'debit' ? <Text className="debit-col">借</Text> : <Text className="credit-col">贷</Text> },
    { title: '末级', dataIndex: 'isLeaf', width: 70, align: 'center' as const, render: (v: boolean) => v ? <Tag color="blue">末级</Tag> : '' },
    {
      title: '状态', dataIndex: 'isEnabled', width: 80,
      render: (v: boolean, r: Account) => (
        <Switch checked={v} size="small"
          onChange={async checked => { await api.updateAccount(r.code, { isEnabled: checked }); setAccounts(prev => prev.map(a => a.code === r.code ? { ...a, isEnabled: checked } : a)) }} />
      )
    },
    {
      title: '操作', width: 120,
      render: (_: unknown, r: Account) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该科目？" onConfirm={() => handleDelete(r.code)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  // 获取可选的父级科目（非末级）
  const parentOptions = accounts
    .filter(a => !a.isLeaf || a.code === editingAccount?.parentCode)
    .map(a => ({ value: a.code, label: `${a.code} ${a.name}` }))

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>科目设置</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增科目</Button>
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
        rowClassName={r => r.level === 1 ? 'ant-table-row-level-0' : ''}
      />

      <Modal
        title={editingAccount ? '编辑科目' : '新增科目'}
        open={showForm}
        onOk={handleSave}
        onCancel={() => { setShowForm(false); form.resetFields() }}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="科目代码" rules={[{ required: true, message: '请输入科目代码' }]}>
            <Input placeholder="如 1001" disabled={!!editingAccount} />
          </Form.Item>
          <Form.Item name="name" label="科目名称" rules={[{ required: true, message: '请输入科目名称' }]}>
            <Input placeholder="如 库存现金" />
          </Form.Item>
          <Form.Item name="nature" label="科目性质" rules={[{ required: true, message: '请选择科目性质' }]}>
            <Select disabled={!!editingAccount} placeholder="选择性质"
              options={Object.entries(NATURE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Form.Item name="parentCode" label="上级科目">
            <Select allowClear placeholder="无（一级科目）" showSearch optionFilterProp="label"
              disabled={!!editingAccount} options={parentOptions} />
          </Form.Item>
          <Space>
            <Form.Item name="isLeaf" label="末级科目" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isEnabled" label="启用状态" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  )
}
