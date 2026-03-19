import { useEffect, useState } from 'react'
import { Card, Table, Typography, Space, Button, Spin, Row, Col, Statistic } from 'antd'
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons'
import { api, type BalanceSheet } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography
const fmt = (n: number) => n ? n.toFixed(2) : '—'

export default function BalanceSheetPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<BalanceSheet | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentPeriod) return
    setLoading(true)
    api.balanceSheet(currentPeriod.id).then(r => setData(r.data.data)).finally(() => setLoading(false))
  }, [currentPeriod?.id])

  if (!data) return <Spin spinning={loading}><div style={{ height: 300 }} /></Spin>

  const totalCurrentAssets = Object.values(data.assets.current).reduce((a, b) => a + b, 0)
  const totalNonCurrentAssets = Object.values(data.assets.nonCurrent).reduce((a, b) => a + b, 0)
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets

  const totalCurrentLiab = Object.values(data.liabilities.current).reduce((a, b) => a + b, 0)
  const totalNonCurrentLiab = Object.values(data.liabilities.nonCurrent).reduce((a, b) => a + b, 0)
  const totalLiab = totalCurrentLiab + totalNonCurrentLiab
  const totalEquity = Object.values(data.equity).reduce((a, b) => a + b, 0)

  const assetItems = [
    { label: '流动资产：', amount: null, bold: true },
    { label: '  库存现金', amount: data.assets.current.cash },
    { label: '  银行存款', amount: data.assets.current.bankDeposit },
    { label: '  应收票据', amount: data.assets.current.receivableNotes },
    { label: '  应收账款', amount: data.assets.current.receivable },
    { label: '  预付账款', amount: data.assets.current.prepaid },
    { label: '  其他应收款', amount: data.assets.current.otherReceivable },
    { label: '  存货', amount: data.assets.current.inventory },
    { label: '流动资产合计', amount: totalCurrentAssets, bold: true },
    { label: '非流动资产：', amount: null, bold: true },
    { label: '  固定资产原值', amount: data.assets.nonCurrent.fixedAsset },
    { label: '  减：累计折旧', amount: data.assets.nonCurrent.accumulatedDepreciation },
    { label: '  固定资产净值', amount: (data.assets.nonCurrent.fixedAsset ?? 0) + (data.assets.nonCurrent.accumulatedDepreciation ?? 0) },
    { label: '  无形资产', amount: data.assets.nonCurrent.intangible },
    { label: '非流动资产合计', amount: totalNonCurrentAssets, bold: true },
    { label: '资产总计', amount: totalAssets, bold: true, highlight: true },
  ]

  const liabEquityItems = [
    { label: '流动负债：', amount: null, bold: true },
    { label: '  短期借款', amount: data.liabilities.current.shortLoan },
    { label: '  应付账款', amount: data.liabilities.current.payable },
    { label: '  预收账款', amount: data.liabilities.current.advanceReceipt },
    { label: '  应付职工薪酬', amount: data.liabilities.current.employeePayable },
    { label: '  应交税费', amount: data.liabilities.current.taxPayable },
    { label: '  其他应付款', amount: data.liabilities.current.other },
    { label: '流动负债合计', amount: totalCurrentLiab, bold: true },
    { label: '非流动负债合计', amount: totalNonCurrentLiab, bold: true },
    { label: '负债合计', amount: totalLiab, bold: true },
    { label: '所有者权益：', amount: null, bold: true },
    { label: '  实收资本', amount: data.equity.paidIn },
    { label: '  盈余公积', amount: data.equity.surplus },
    { label: '  本年利润', amount: data.equity.currentProfit },
    { label: '  未分配利润', amount: data.equity.retained },
    { label: '所有者权益合计', amount: totalEquity, bold: true },
    { label: '负债和所有者权益总计', amount: totalLiab + totalEquity, bold: true, highlight: true },
  ]

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>资产负债表</Title>
            <Text type="secondary">{currentPeriod?.name}</Text>
          </div>
          <Space>
            <Button icon={<PrinterOutlined />}>打印</Button>
            <Button icon={<DownloadOutlined />}>导出 PDF</Button>
          </Space>
        </div>

        <Row gutter={16}>
          <Col span={8}><Card size="small"><Statistic title="资产总计" value={totalAssets.toFixed(2)} prefix="¥" valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="负债合计" value={totalLiab.toFixed(2)} prefix="¥" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="所有者权益" value={totalEquity.toFixed(2)} prefix="¥" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>

        <Card size="small">
          <Row gutter={0}>
            <Col span={12} style={{ borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
              <Title level={5} style={{ textAlign: 'center', marginBottom: 12 }}>资产</Title>
              {assetItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: item.highlight ? '#e6f4ff' : 'transparent', borderTop: item.highlight ? '2px solid #1677ff' : 'none', marginBottom: 2 }}>
                  <Text style={{ fontWeight: item.bold ? 600 : 400 }}>{item.label}</Text>
                  {item.amount !== null && <Text style={{ fontWeight: item.bold ? 600 : 400 }}>{fmt(item.amount ?? 0)}</Text>}
                </div>
              ))}
            </Col>
            <Col span={12} style={{ paddingLeft: 16 }}>
              <Title level={5} style={{ textAlign: 'center', marginBottom: 12 }}>负债和所有者权益</Title>
              {liabEquityItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: item.highlight ? '#e6f4ff' : 'transparent', borderTop: item.highlight ? '2px solid #1677ff' : 'none', marginBottom: 2 }}>
                  <Text style={{ fontWeight: item.bold ? 600 : 400 }}>{item.label}</Text>
                  {item.amount !== null && <Text style={{ fontWeight: item.bold ? 600 : 400 }}>{fmt(item.amount ?? 0)}</Text>}
                </div>
              ))}
            </Col>
          </Row>
        </Card>
      </Space>
    </Spin>
  )
}
