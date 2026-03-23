import { useEffect, useState } from 'react'
import { Table, Typography, Space, Tag, Card, Statistic, Row, Col } from 'antd'
import { api, type GeneralLedgerRow } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import ModuleTabBar from '@/components/layout/ModuleTabBar'

const LEDGER_TABS = [
  { key: 'trial-balance', label: '科目余额表', path: '/ledger/trial-balance' },
  { key: 'detail', label: '明细账', path: '/ledger/detail' },
  { key: 'general', label: '总账', path: '/ledger/general' },
]

const { Title, Text } = Typography

const NATURE_COLORS: Record<string, string> = {
  asset: 'blue', liability: 'orange', equity: 'purple', income: 'green', expense: 'red'
}
const NATURE_LABELS: Record<string, string> = {
  asset: '资产', liability: '负债', equity: '权益', income: '收入', expense: '费用'
}

export default function GeneralLedgerPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<GeneralLedgerRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentPeriod) return
    setLoading(true)
    api.generalLedger(currentPeriod.id).then(r => setData(r.data.data)).finally(() => setLoading(false))
  }, [currentPeriod?.id])

  const totalAssets = data.filter(r => r.nature === 'asset').reduce((s, r) => s + r.closingBalance, 0)
  const totalLiabilities = data.filter(r => r.nature === 'liability').reduce((s, r) => s + Math.abs(r.closingBalance), 0)
  const totalEquity = data.filter(r => r.nature === 'equity').reduce((s, r) => s + Math.abs(r.closingBalance), 0)

  const columns = [
    {
      title: '科目', render: (_: unknown, r: GeneralLedgerRow) => (
        <Space>
          <Text strong>{r.accountCode}</Text>
          <Text>{r.accountName}</Text>
          <Tag color={NATURE_COLORS[r.nature]} style={{ fontSize: 11 }}>{NATURE_LABELS[r.nature]}</Tag>
        </Space>
      )
    },
    { title: '期初余额', dataIndex: 'openingBalance', align: 'right' as const, width: 130, render: (v: number) => v.toFixed(2) },
    { title: '本期借方', dataIndex: 'debitAmount', align: 'right' as const, width: 130, render: (v: number) => v ? <Text className="debit-col">{v.toFixed(2)}</Text> : '' },
    { title: '本期贷方', dataIndex: 'creditAmount', align: 'right' as const, width: 130, render: (v: number) => v ? <Text className="credit-col">{v.toFixed(2)}</Text> : '' },
    {
      title: '期末余额', dataIndex: 'closingBalance', align: 'right' as const, width: 140,
      render: (v: number) => <Text strong className={v >= 0 ? 'balance-positive' : 'balance-negative'}>{v.toFixed(2)}</Text>
    },
    {
      title: '环比变化', width: 100, align: 'right' as const,
      render: (_: unknown, r: GeneralLedgerRow) => {
        const prev = r.prevClosingBalance
        if (!prev) return ''
        const change = ((r.closingBalance - prev) / Math.abs(prev)) * 100
        return <Text style={{ color: change >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </Text>
      }
    },
  ]

  return (
    <>
    <ModuleTabBar tabs={LEDGER_TABS} />
    <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 16 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>总账</Title>
        <Text type="secondary">{currentPeriod?.name} · 一级科目汇总</Text>
      </div>

      <Row gutter={16}>
        <Col span={8}><Card size="small"><Statistic title="资产总计" value={totalAssets.toFixed(2)} prefix="¥" valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="负债总计" value={totalLiabilities.toFixed(2)} prefix="¥" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="权益总计" value={totalEquity.toFixed(2)} prefix="¥" valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

      <Table
        rowKey="accountCode"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        pagination={false}
      />
    </Space>
    </>
  )
}
