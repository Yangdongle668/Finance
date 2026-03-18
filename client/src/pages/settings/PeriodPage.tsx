import { useEffect, useState } from 'react'
import { Table, Card, Typography, Space, Button, Tag, Popconfirm, message, InputNumber } from 'antd'
import { api, type Period } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import { useAuthStore } from '@/stores/authStore'

const { Title } = Typography

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: '开放', color: 'green' },
  closing: { label: '结账中', color: 'processing' },
  closed: { label: '已结账', color: 'red' },
}

export default function PeriodPage() {
  const { periods, setPeriods } = usePeriodStore()
  const getCurrentRole = useAuthStore(s => s.getCurrentRole)
  const [ensureYear, setEnsureYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)

  const refresh = () => {
    setLoading(true)
    api.listPeriods().then(r => setPeriods(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const handleClose = async (id: string) => {
    await api.closePeriod(id)
    message.success('结账成功')
    refresh()
  }

  const handleReopen = async (id: string) => {
    await api.reopenPeriod(id)
    message.success('反结账成功')
    refresh()
  }

  const handleEnsure = async () => {
    await api.ensurePeriods(ensureYear)
    message.success(`${ensureYear} 年期间初始化完成`)
    refresh()
  }

  const columns = [
    { title: '期间', dataIndex: 'name', width: 140 },
    { title: '开始日期', dataIndex: 'startDate', width: 120 },
    { title: '结束日期', dataIndex: 'endDate', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={STATUS[v]?.color}>{STATUS[v]?.label}</Tag> },
    { title: '结账时间', dataIndex: 'closedAt', render: (v: string) => v?.slice(0, 19) || '—' },
    {
      title: '操作', width: 160,
      render: (_: unknown, r: Period) => (
        <Space>
          {r.status === 'open' && (
            <Popconfirm title="确认结账？结账后当期凭证将锁定。" onConfirm={() => handleClose(r.id)}>
              <Button size="small" type="primary">结账</Button>
            </Popconfirm>
          )}
          {r.status === 'closed' && getCurrentRole() === 'admin' && (
            <Popconfirm title="确认反结账？需要管理员权限。" onConfirm={() => handleReopen(r.id)}>
              <Button size="small" danger>反结账</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>期间管理</Title>

      <Card size="small" title="初始化期间">
        <Space>
          <InputNumber value={ensureYear} onChange={v => setEnsureYear(v ?? new Date().getFullYear())} min={2020} max={2030} style={{ width: 100 }} />
          <Button onClick={handleEnsure}>初始化该年全部期间</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={periods}
        loading={loading}
        size="small"
        pagination={false}
      />
    </Space>
  )
}
