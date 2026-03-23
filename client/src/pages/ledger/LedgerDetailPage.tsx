import { useEffect, useState } from 'react'
import { Table, Card, Typography, Space, Select, Statistic, Row, Col, Empty } from 'antd'
import { api, type Account, type LedgerResult } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import ModuleTabBar from '@/components/layout/ModuleTabBar'

const LEDGER_TABS = [
  { key: 'trial-balance', label: '科目余额表', path: '/ledger/trial-balance' },
  { key: 'detail', label: '明细账', path: '/ledger/detail' },
  { key: 'general', label: '总账', path: '/ledger/general' },
]

const { Title, Text } = Typography

export default function LedgerDetailPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>()
  const [ledger, setLedger] = useState<LedgerResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.leafAccounts().then(r => setAccounts(r.data.data)) }, [])

  useEffect(() => {
    if (!selectedAccount || !currentPeriod) return
    setLoading(true)
    api.ledger(selectedAccount, currentPeriod.id).then(r => setLedger(r.data.data)).finally(() => setLoading(false))
  }, [selectedAccount, currentPeriod?.id])

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '凭证号', dataIndex: 'voucherNo', width: 140 },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    { title: '借方', dataIndex: 'debit', width: 120, align: 'right' as const, render: (v: number) => v ? <Text className="debit-col">{v.toFixed(2)}</Text> : '' },
    { title: '贷方', dataIndex: 'credit', width: 120, align: 'right' as const, render: (v: number) => v ? <Text className="credit-col">{v.toFixed(2)}</Text> : '' },
    {
      title: '余额', dataIndex: 'balance', width: 130, align: 'right' as const,
      render: (v: number) => <Text className={v >= 0 ? 'balance-positive' : 'balance-negative'} strong>{v.toFixed(2)}</Text>
    },
  ]

  return (
    <>
    <ModuleTabBar tabs={LEDGER_TABS} />
    <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 16 }}>
      <Title level={4} style={{ margin: 0 }}>明细账</Title>

      <Card size="small">
        <Space>
          <Text>选择科目：</Text>
          <Select
            showSearch style={{ width: 280 }} placeholder="搜索科目代码或名称"
            optionFilterProp="label" value={selectedAccount}
            onChange={setSelectedAccount}
            options={accounts.map(a => ({ value: a.code, label: `${a.code} ${a.name}` }))}
          />
          <Text type="secondary">{currentPeriod?.name}</Text>
        </Space>
      </Card>

      {ledger && (
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small">
              <Statistic title="期初余额" value={ledger.openingBalance.toFixed(2)} prefix="¥" />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="本期借方合计" value={ledger.lines.reduce((s, l) => s + l.debit, 0).toFixed(2)}
                prefix="¥" valueStyle={{ color: '#d4380d' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="本期贷方合计" value={ledger.lines.reduce((s, l) => s + l.credit, 0).toFixed(2)}
                prefix="¥" valueStyle={{ color: '#389e0d' }} />
            </Card>
          </Col>
        </Row>
      )}

      {!selectedAccount ? (
        <Empty description="请选择科目查看明细账" />
      ) : (
        <Table
          rowKey={(r) => r.voucherNo + r.date}
          columns={columns}
          dataSource={ledger?.lines ?? []}
          loading={loading}
          size="small"
          pagination={{ pageSize: 50, showTotal: t => `共 ${t} 条` }}
        />
      )}
    </Space>
    </>
  )
}
