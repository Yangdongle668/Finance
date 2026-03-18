import { useEffect, useState } from 'react'
import { Row, Col, Card, Typography, Spin, Space, Tabs, Tooltip } from 'antd'
import { QuestionCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, type DashboardData } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Text } = Typography

const fmt = (n: number) =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtWan = (n: number) =>
  (n / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`

function ChangeTag({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <Text type="secondary" style={{ fontSize: 12 }}>{label}: --</Text>
  const isUp = value > 0
  const color = isUp ? '#f5222d' : '#52c41a'
  return (
    <Text style={{ fontSize: 12, color }}>
      {label}: {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(value * 100).toFixed(2)}%
    </Text>
  )
}

function SectionTitle({ title, tip }: { title: string; tip?: string }) {
  return (
    <Space size={4}>
      <Text strong style={{ color: '#1677ff', fontSize: 14 }}>{title}</Text>
      {tip && (
        <Tooltip title={tip}>
          <QuestionCircleOutlined style={{ color: '#bbb', fontSize: 12 }} />
        </Tooltip>
      )}
    </Space>
  )
}

export default function DashboardPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [rpTab, setRpTab] = useState<'receivable' | 'payable'>('receivable')

  useEffect(() => {
    if (!currentPeriod) return
    setLoading(true)
    api.dashboard(currentPeriod.id)
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false))
  }, [currentPeriod?.id])

  if (!data) return <Spin spinning={loading} style={{ width: '100%', padding: 100, textAlign: 'center' }} />

  const periodLabel = currentPeriod ? `${currentPeriod.year}年${String(currentPeriod.month).padStart(2, '0')}期` : ''

  // Net profit trend chart
  const profitTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['净利润', '净利润率'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 10, left: 50, right: 50, bottom: 30 },
    xAxis: { type: 'category', data: data.trend.map(t => t.period), axisLabel: { fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '金额/万', axisLabel: { formatter: (v: number) => fmtWan(v), fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
      { type: 'value', name: '净利润率/%', axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      { name: '净利润', type: 'bar', data: data.trend.map(t => t.netProfit), barMaxWidth: 30, itemStyle: { color: '#1677ff', borderRadius: [3, 3, 0, 0] } },
      { name: '净利润率', type: 'line', yAxisIndex: 1, data: data.trend.map(t => t.netMargin), lineStyle: { color: '#faad14' }, itemStyle: { color: '#faad14' }, symbol: 'circle', symbolSize: 4 },
    ],
  }

  // Revenue & cost trend chart
  const revenueTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '成本'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 10, left: 50, right: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.trend.map(t => t.period), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '金额/万', axisLabel: { formatter: (v: number) => fmtWan(v), fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      { name: '收入', type: 'bar', data: data.trend.map(t => t.revenue), barMaxWidth: 20, itemStyle: { color: '#1677ff', borderRadius: [3, 3, 0, 0] } },
      { name: '成本', type: 'bar', data: data.trend.map(t => t.cost), barMaxWidth: 20, itemStyle: { color: '#ff7a45', borderRadius: [3, 3, 0, 0] } },
    ],
  }

  // Expense donut chart
  const expenseDonutOption = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      data: data.expenses.breakdown.map((e, i) => ({
        name: e.name,
        value: e.value.toFixed(2),
        itemStyle: { color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'][i % 5] },
      })),
    }],
  }

  const rpList = rpTab === 'receivable'
    ? data.receivablePayable.topReceivables
    : data.receivablePayable.topPayables
  const rpTotal = rpTab === 'receivable'
    ? data.receivablePayable.totalReceivable
    : data.receivablePayable.totalPayable

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* ── Top Row: 3 cards ───────────────────────── */}
        <Row gutter={16}>
          {/* Card 1: 资金余额 */}
          <Col xs={24} lg={8}>
            <Card size="small" styles={{ body: { padding: '16px 20px' } }}
              title={<SectionTitle title="资金余额" tip="银行存款+库存现金" />}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{periodLabel}</Text>}
            >
              <div style={{ marginBottom: 16 }}>
                <SectionTitle title="资金余额" tip="当前账面资金总额" />
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>
                  {fmt(data.funds.total)}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text type="secondary">银行存款</Text>
                  <Text>{fmt(data.fundDetails.bankDeposit)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text type="secondary">库存现金</Text>
                  <Text>{fmt(data.fundDetails.cashOnHand)}</Text>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 8 }}>
                <Space size={4}>
                  <SectionTitle title="资金净收入" tip="本期现金收入-支出" />
                </Space>
                <div style={{
                  fontSize: 20, fontWeight: 600, marginTop: 4,
                  color: data.fundDetails.netCashFlow >= 0 ? '#1677ff' : '#ff4d4f',
                }}>
                  {fmt(data.fundDetails.netCashFlow)}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 24 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    收入：{fmt(data.fundDetails.cashIncome)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    支出：{fmt(data.fundDetails.cashExpense)}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>

          {/* Card 2: 应收/应付 */}
          <Col xs={24} lg={8}>
            <Card size="small" styles={{ body: { padding: '16px 20px' } }}
              title={
                <Tabs
                  activeKey={rpTab}
                  onChange={k => setRpTab(k as 'receivable' | 'payable')}
                  size="small"
                  style={{ marginBottom: -16 }}
                  items={[
                    { key: 'receivable', label: <Text style={{ color: rpTab === 'receivable' ? '#1677ff' : undefined }}>应收</Text> },
                    { key: 'payable', label: <Text style={{ color: rpTab === 'payable' ? '#1677ff' : undefined }}>应付</Text> },
                  ]}
                />
              }
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{periodLabel}</Text>}
            >
              <div style={{ marginBottom: 16 }}>
                <SectionTitle
                  title={rpTab === 'receivable' ? '应收账款' : '应付账款'}
                  tip={rpTab === 'receivable' ? '客户尚未支付的货款' : '尚未支付给供应商的货款'}
                />
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>
                  {fmt(rpTotal)}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                {rpList.length > 0 ? rpList.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text type="secondary" ellipsis style={{ flex: 1, marginRight: 8 }}>{item.name}</Text>
                    <Text>{fmt(item.amount)}</Text>
                  </div>
                )) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>暂无数据</Text>
                )}
              </div>
            </Card>
          </Col>

          {/* Card 3: 预计可用资金 */}
          <Col xs={24} lg={8}>
            <Card size="small" styles={{ body: { padding: '16px 20px' } }}
              title={<SectionTitle title="预计可用资金" tip="现有资金+短期应收款-短期应付款" />}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{periodLabel}</Text>}
            >
              <div style={{ marginBottom: 16 }}>
                <SectionTitle title="预计可用资金" />
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>
                  {fmt(data.estimatedFunds.total)}
                </div>
              </div>

              {/* Formula display */}
              <div style={{
                background: '#f6f8fa', borderRadius: 8, padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                flexWrap: 'wrap', marginBottom: 16,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    现有资金 <Tooltip title="银行存款+库存现金"><QuestionCircleOutlined style={{ fontSize: 10 }} /></Tooltip>
                  </Text>
                  <div style={{ fontWeight: 600 }}>{fmt(data.estimatedFunds.currentFunds)}</div>
                </div>
                <Text strong style={{ fontSize: 18, color: '#52c41a' }}>+</Text>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    短期应收款 <Tooltip title="短期内预计可收回的应收账款"><QuestionCircleOutlined style={{ fontSize: 10 }} /></Tooltip>
                  </Text>
                  <div style={{ fontWeight: 600 }}>{fmt(data.estimatedFunds.shortTermReceivable)}</div>
                </div>
                <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>-</Text>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    短期应付款 <Tooltip title="短期内需要支付的应付账款"><QuestionCircleOutlined style={{ fontSize: 10 }} /></Tooltip>
                  </Text>
                  <div style={{ fontWeight: 600 }}>{fmt(data.estimatedFunds.shortTermPayable)}</div>
                </div>
              </div>

              {/* Ratios */}
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>现金比率</Text>
                      <Tooltip title="现金类资产/流动负债"><QuestionCircleOutlined style={{ fontSize: 10, color: '#bbb' }} /></Tooltip>
                    </Space>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>
                      {pctFmt(data.estimatedFunds.cashRatio)}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>速动比率</Text>
                      <Tooltip title="速动资产/流动负债"><QuestionCircleOutlined style={{ fontSize: 10, color: '#bbb' }} /></Tooltip>
                    </Space>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>
                      {pctFmt(data.estimatedFunds.quickRatio)}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* ── Bottom Row: 3 cards ──────────────────── */}
        <Row gutter={16}>
          {/* Card 4: 净利润 */}
          <Col xs={24} lg={8}>
            <Card size="small" styles={{ body: { padding: '16px 20px' } }}
              title={<SectionTitle title="净利润" tip="营业收入扣除所有成本费用及税费后的利润" />}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{periodLabel}</Text>}
            >
              <div style={{ marginBottom: 12 }}>
                <SectionTitle title="净利润" />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{
                    fontSize: 28, fontWeight: 700, marginTop: 4,
                    color: data.profitability.netProfit >= 0 ? '#1677ff' : '#ff4d4f',
                  }}>
                    {fmt(data.profitability.netProfit)}
                  </div>
                  <Space direction="vertical" size={0}>
                    <ChangeTag value={data.profitability.netProfitChangeVsPrev} label="较上期" />
                    <ChangeTag value={data.profitability.netProfitChangeVsSameYear} label="较同期" />
                  </Space>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <SectionTitle title="净利润率" />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>
                    {pctFmt(data.profitability.netMargin)}
                  </div>
                  <Space direction="vertical" size={0}>
                    <ChangeTag value={data.profitability.netMarginChangeVsPrev} label="较上期" />
                    <ChangeTag value={data.profitability.netMarginChangeVsSameYear} label="较同期" />
                  </Space>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>近期变动趋势</Text>
                <ReactECharts option={profitTrendOption} style={{ height: 160 }} />
              </div>
            </Card>
          </Col>

          {/* Card 5: 收入成本 */}
          <Col xs={24} lg={8}>
            <Card size="small" styles={{ body: { padding: '16px 20px' } }}
              title={<SectionTitle title="收入成本" tip="本期营业收入与营业成本" />}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{periodLabel}</Text>}
            >
              <div style={{ marginBottom: 12 }}>
                <SectionTitle title="收入" />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>
                    {fmt(data.profitability.revenue)}
                  </div>
                  <Space direction="vertical" size={0}>
                    <ChangeTag value={data.profitability.revenueChangeVsPrev} label="较上期" />
                    <ChangeTag value={data.profitability.revenueChangeVsSameYear} label="较同期" />
                  </Space>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <SectionTitle title="成本" />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#ff7a45' }}>
                    {fmt(data.profitability.costOfGoods)}
                  </div>
                  <Space direction="vertical" size={0}>
                    <ChangeTag value={data.profitability.costChangeVsPrev} label="较上期" />
                    <ChangeTag value={data.profitability.costChangeVsSameYear} label="较同期" />
                  </Space>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  毛利率：{pctFmt(data.profitability.grossMargin)}
                </Text>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>近期变动趋势</Text>
                <ReactECharts option={revenueTrendOption} style={{ height: 160 }} />
              </div>
            </Card>
          </Col>

          {/* Card 6: 费用 */}
          <Col xs={24} lg={8}>
            <Card size="small" styles={{ body: { padding: '16px 20px' } }}
              title={<SectionTitle title="费用" tip="管理费用+销售费用+财务费用+研发费用" />}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{periodLabel}</Text>}
            >
              <div style={{ marginBottom: 12 }}>
                <SectionTitle title="费用" />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>
                    {fmt(data.expenses.total)}
                  </div>
                  <Space direction="vertical" size={0}>
                    <ChangeTag value={data.expenses.expenseChangeVsPrev} label="较上期" />
                    <ChangeTag value={data.expenses.expenseChangeVsSameYear} label="较同期" />
                  </Space>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                {data.expenses.breakdown.length > 0 ? (
                  <>
                    <ReactECharts option={expenseDonutOption} style={{ height: 160 }} />
                    <div style={{ marginTop: 8 }}>
                      {data.expenses.breakdown.map((e, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Space size={6}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'][i % 5],
                            }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>{e.name}</Text>
                          </Space>
                          <Text style={{ fontSize: 12 }}>{fmt(e.value)}</Text>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>暂无费用数据</Text>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </Space>
    </Spin>
  )
}
