import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Typography, Spin, Space, Tag, Progress } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, BankOutlined, DollarOutlined, LineChartOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, type Dashboard, type IncomeStatement } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography
const fmt = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export default function DashboardPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [income, setIncome] = useState<IncomeStatement | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentPeriod) return
    setLoading(true)
    Promise.all([
      api.dashboard(currentPeriod.id),
      api.incomeStatement(currentPeriod.id),
    ]).then(([d, i]) => {
      setDashboard(d.data.data)
      setIncome(i.data.data)
    }).finally(() => setLoading(false))
  }, [currentPeriod?.id])

  const incomeChartOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: ['营业收入', '营业成本', '毛利', '运营利润', '净利润'] },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `¥${(v / 10000).toFixed(0)}万` } },
    series: [{
      type: 'bar',
      data: income ? [
        { value: income.revenue, itemStyle: { color: '#1677ff' } },
        { value: income.costOfGoods, itemStyle: { color: '#ff4d4f' } },
        { value: income.grossProfit, itemStyle: { color: '#52c41a' } },
        { value: income.operatingProfit, itemStyle: { color: '#faad14' } },
        { value: income.netProfit, itemStyle: { color: income.netProfit >= 0 ? '#52c41a' : '#ff4d4f' } },
      ] : [],
      barMaxWidth: 60,
      label: { show: true, position: 'top', formatter: (p: { value: number }) => `¥${(p.value / 10000).toFixed(1)}万` },
    }],
  }

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>财务概览</Title>
          <Space>
            <Text type="secondary">{currentPeriod?.name}</Text>
            <Tag color={currentPeriod?.status === 'open' ? 'green' : 'red'}>
              {currentPeriod?.status === 'open' ? '期间开放' : '已结账'}
            </Tag>
          </Space>
        </div>

        {/* 资金卡片 */}
        <Row gutter={[16, 16]}>
          {[
            { title: '资金总额', value: dashboard?.funds.total ?? 0, icon: <BankOutlined />, color: '#1677ff' },
            { title: '银行存款', value: dashboard?.funds.bank ?? 0, icon: <DollarOutlined />, color: '#52c41a' },
            { title: '应收账款', value: dashboard?.funds.receivable ?? 0, icon: <ArrowUpOutlined />, color: '#faad14' },
            { title: '应付账款', value: dashboard?.funds.payable ?? 0, icon: <ArrowDownOutlined />, color: '#ff4d4f' },
          ].map(item => (
            <Col xs={24} sm={12} lg={6} key={item.title}>
              <Card className="stat-card" size="small" style={{ borderTop: `3px solid ${item.color}` }}>
                <Statistic
                  title={<Space>{item.icon}<span>{item.title}</span></Space>}
                  value={item.value}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: item.color }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* 盈利分析 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title={<Space><LineChartOutlined />损益分析</Space>} size="small">
              <ReactECharts option={incomeChartOption} style={{ height: 280 }} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={<Space><SafetyCertificateOutlined />财务健康度</Space>} size="small">
              <Space direction="vertical" style={{ width: '100%', padding: '8px 0' }} size={20}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text>毛利率</Text>
                    <Text strong style={{ color: '#52c41a' }}>{pct(dashboard?.profitability.grossMargin ?? 0)}</Text>
                  </div>
                  <Progress percent={Math.round((dashboard?.profitability.grossMargin ?? 0) * 100)} strokeColor="#52c41a" size="small" showInfo={false} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text>净利率</Text>
                    <Text strong style={{ color: '#1677ff' }}>{pct(dashboard?.profitability.netMargin ?? 0)}</Text>
                  </div>
                  <Progress percent={Math.round(Math.max(0, (dashboard?.profitability.netMargin ?? 0)) * 100)} strokeColor="#1677ff" size="small" showInfo={false} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text>资产负债率</Text>
                    <Text strong style={{ color: (dashboard?.solvency.debtRatio ?? 0) > 0.6 ? '#ff4d4f' : '#faad14' }}>
                      {pct(dashboard?.solvency.debtRatio ?? 0)}
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round((dashboard?.solvency.debtRatio ?? 0) * 100)}
                    strokeColor={(dashboard?.solvency.debtRatio ?? 0) > 0.6 ? '#ff4d4f' : '#faad14'}
                    size="small" showInfo={false}
                  />
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic title="总资产" value={fmt(dashboard?.solvency.totalAssets ?? 0)} valueStyle={{ fontSize: 16 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="净利润" value={fmt(dashboard?.profitability.netProfit ?? 0)}
                      valueStyle={{ fontSize: 16, color: (dashboard?.profitability.netProfit ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }} />
                  </Col>
                </Row>
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </Spin>
  )
}
