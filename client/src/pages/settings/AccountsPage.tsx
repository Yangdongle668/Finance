import { useEffect, useState } from 'react'
import { Table, Card, Typography, Space, Switch, Tag, Input, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api, type Account } from '@/api/client'

const { Title, Text } = Typography

const NATURE_COLORS: Record<string, string> = {
  asset: 'blue', liability: 'orange', equity: 'purple', income: 'green', expense: 'red'
}
const NATURE_LABELS: Record<string, string> = {
  asset: '资产', liability: '负债', equity: '权益', income: '收入', expense: '费用'
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [nature, setNature] = useState('')

  useEffect(() => {
    setLoading(true)
    api.listAccounts().then(r => setAccounts(r.data.data)).finally(() => setLoading(false))
  }, [])

  const filtered = accounts.filter(a => {
    const kw = keyword.toLowerCase()
    const matchKw = !kw || a.code.includes(kw) || a.name.toLowerCase().includes(kw)
    const matchNature = !nature || a.nature === nature
    return matchKw && matchNature
  })

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
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>科目设置</Title>

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
    </Space>
  )
}
