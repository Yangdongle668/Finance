import { useEffect, useState } from 'react'
import { Card, Typography, Space, Button, Spin, Row, Col, Statistic, Progress } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { api, type IncomeStatement } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography
const fmt = (n: number) => `¥${n.toFixed(2)}`
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export default function IncomeStatementPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<IncomeStatement | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentPeriod) return
    setLoading(true)
    api.incomeStatement(currentPeriod.id).then(r => setData(r.data.data)).finally(() => setLoading(false))
  }, [currentPeriod?.id])

  if (!data) return <Spin spinning={loading}><div style={{ height: 300 }} /></Spin>

  const ext = data as never as Record<string, number>
  const items = [
    { label: '一、营业收入', amount: data.revenue, note: '', highlight: true },
    { label: '减：营业成本', amount: -data.costOfGoods, note: `占收入 ${data.revenue ? pct(data.costOfGoods / data.revenue) : '—'}` },
    { label: '二、毛利润', amount: data.grossProfit, bold: true, note: `毛利率 ${pct(data.grossMargin)}` },
    { label: '减：税金及附加', amount: -(ext.taxSurcharge ?? 0) },
    { label: '减：销售费用', amount: -data.sellingExp, note: data.revenue ? pct(data.sellingExp / data.revenue) : '' },
    { label: '减：管理费用', amount: -data.adminExp, note: data.revenue ? pct(data.adminExp / data.revenue) : '' },
    { label: '减：研发费用', amount: -(ext.rdExp ?? 0) },
    { label: '减：财务费用', amount: -data.financeExp },
    { label: '三、营业利润', amount: data.operatingProfit, bold: true, note: `营业利润率 ${pct(data.operatingMargin)}` },
    { label: '加：营业外收入', amount: ext.nonOpIncome ?? 0 },
    { label: '减：营业外支出', amount: -(ext.nonOpExpense ?? 0) },
    { label: '四、利润总额', amount: ext.profitBeforeTax ?? data.netProfit, bold: true },
    { label: '减：所得税费用', amount: -(ext.incomeTax ?? 0) },
    { label: '五、净利润', amount: data.netProfit, bold: true, highlight: true, note: `净利率 ${pct(data.netMargin)}` },
  ]

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>利润表（损益表）</Title>
            <Text type="secondary">{currentPeriod?.name}</Text>
          </div>
          <Button icon={<PrinterOutlined />}>打印</Button>
        </div>

        <Row gutter={16}>
          <Col span={6}><Card size="small"><Statistic title="营业收入" value={fmt(data.revenue)} valueStyle={{ fontSize: 16, color: '#1677ff' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="毛利润" value={fmt(data.grossProfit)} valueStyle={{ fontSize: 16, color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="营业利润" value={fmt(data.operatingProfit)} valueStyle={{ fontSize: 16, color: data.operatingProfit >= 0 ? '#1677ff' : '#cf1322' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="净利润" value={fmt(data.netProfit)} valueStyle={{ fontSize: 16, color: data.netProfit >= 0 ? '#52c41a' : '#cf1322' }} /></Card></Col>
        </Row>

        <Row gutter={16}>
          <Col span={14}>
            <Card size="small" title="利润表明细">
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: item.highlight ? '#f0f7ff' : 'transparent', borderTop: item.highlight ? '2px solid #1677ff' : '1px solid #f0f0f0', marginBottom: 1 }}>
                  <Text style={{ fontWeight: item.bold ? 600 : 400 }}>{item.label}</Text>
                  <Space>
                    {item.note && <Text type="secondary" style={{ fontSize: 12 }}>{item.note}</Text>}
                    <Text style={{ fontWeight: item.bold ? 600 : 400, color: item.amount >= 0 ? '#1677ff' : '#cf1322', minWidth: 120, textAlign: 'right' }}>
                      {fmt(item.amount)}
                    </Text>
                  </Space>
                </div>
              ))}
            </Card>
          </Col>
          <Col span={10}>
            <Card size="small" title="利润率分析">
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {[
                  { label: '毛利率', value: data.grossMargin, color: '#52c41a' },
                  { label: '营业利润率', value: data.operatingMargin, color: '#1677ff' },
                  { label: '净利率', value: data.netMargin, color: '#722ed1' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{item.label}</Text>
                      <Text strong style={{ color: item.color }}>{pct(item.value)}</Text>
                    </div>
                    <Progress percent={Math.max(0, Math.round(item.value * 100))} strokeColor={item.color} size="small" showInfo={false} />
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </Spin>
  )
}
