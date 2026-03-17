import { useEffect, useState } from 'react'
import { Table, Card, Typography, Space, Button, Tag, Alert, Statistic, Row, Col } from 'antd'
import { DownloadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, type TrialBalanceRow } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography

const NATURE_LABELS: Record<string, { label: string; color: string }> = {
  asset: { label: '资产', color: 'blue' },
  liability: { label: '负债', color: 'orange' },
  equity: { label: '权益', color: 'purple' },
  income: { label: '收入', color: 'green' },
  expense: { label: '费用', color: 'red' },
}

export default function TrialBalancePage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<TrialBalanceRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentPeriod) return
    setLoading(true)
    api.trialBalance(currentPeriod.id).then(r => {
      setData(r.data.data)
    }).finally(() => setLoading(false))
  }, [currentPeriod?.id])

  const nonZero = data.filter(r => r.closingDebit + r.closingCredit + r.debitAmount + r.creditAmount > 0)
  const totalDebit = nonZero.filter(r => r.level === 1).reduce((s, r) => s + r.closingDebit, 0)
  const totalCredit = nonZero.filter(r => r.level === 1).reduce((s, r) => s + r.closingCredit, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const columns: ColumnsType<TrialBalanceRow> = [
    {
      title: '科目代码', dataIndex: 'accountCode', width: 120,
      render: (v, r) => <Text style={{ paddingLeft: (r.level - 1) * 16 }}>{v}</Text>
    },
    { title: '科目名称', dataIndex: 'accountName', ellipsis: true },
    {
      title: '性质', dataIndex: 'nature', width: 70,
      render: v => <Tag color={NATURE_LABELS[v]?.color}>{NATURE_LABELS[v]?.label}</Tag>
    },
    {
      title: '期初余额', children: [
        { title: '借方', dataIndex: 'openingDebit', width: 110, align: 'right' as const, render: (v: number) => v ? v.toFixed(2) : '' },
        { title: '贷方', dataIndex: 'openingCredit', width: 110, align: 'right' as const, render: (v: number) => v ? v.toFixed(2) : '' },
      ]
    },
    {
      title: '本期发生额', children: [
        { title: '借方', dataIndex: 'debitAmount', width: 110, align: 'right' as const, render: (v: number) => v ? <Text className="debit-col">{v.toFixed(2)}</Text> : '' },
        { title: '贷方', dataIndex: 'creditAmount', width: 110, align: 'right' as const, render: (v: number) => v ? <Text className="credit-col">{v.toFixed(2)}</Text> : '' },
      ]
    },
    {
      title: '期末余额', children: [
        { title: '借方', dataIndex: 'closingDebit', width: 110, align: 'right' as const, render: (v: number) => v ? <Text strong>{v.toFixed(2)}</Text> : '' },
        { title: '贷方', dataIndex: 'closingCredit', width: 110, align: 'right' as const, render: (v: number) => v ? <Text strong>{v.toFixed(2)}</Text> : '' },
      ]
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>科目余额表</Title>
          <Text type="secondary">{currentPeriod?.name}</Text>
        </div>
        <Button icon={<DownloadOutlined />}>导出 Excel</Button>
      </div>

      {/* 借贷平衡检查 */}
      {balanced
        ? <Alert type="success" icon={<CheckCircleOutlined />} message={`借贷平衡 ✓  借方合计：¥${totalDebit.toFixed(2)}   贷方合计：¥${totalCredit.toFixed(2)}`} showIcon />
        : <Alert type="error" icon={<WarningOutlined />} message={`借贷不平衡！差额：¥${Math.abs(totalDebit - totalCredit).toFixed(2)}`} showIcon />}

      <Row gutter={16}>
        {Object.entries(NATURE_LABELS).map(([nature, { label, color }]) => {
          const rows = nonZero.filter(r => r.nature === nature && r.level === 1)
          const total = rows.reduce((s, r) => s + r.closingDebit - r.closingCredit, 0)
          return (
            <Col key={nature} flex="auto">
              <Card size="small">
                <Statistic title={<Tag color={color}>{label}</Tag>} value={Math.abs(total).toFixed(2)} prefix="¥"
                  valueStyle={{ fontSize: 14, color: total >= 0 ? '#1677ff' : '#cf1322' }} />
              </Card>
            </Col>
          )
        })}
      </Row>

      <Table
        rowKey="accountCode"
        columns={columns}
        dataSource={nonZero}
        loading={loading}
        size="small"
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        rowClassName={r => r.level === 1 ? 'ant-table-row-level-0' : ''}
      />
    </Space>
  )
}
