import { useEffect, useState } from 'react'
import { Table, Button, Space, Typography, DatePicker } from 'antd'
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import VoucherTabBar from './VoucherTabBar'

const { Text } = Typography
const { RangePicker } = DatePicker

interface SummaryRow {
  accountCode: string
  accountName: string
  debitAmount: number
  creditAmount: number
}

const fmtAmount = (v: number) =>
  v !== 0 ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

export default function VoucherSummaryPage() {
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [attachmentCount, setAttachmentCount] = useState(0)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const fetchData = async () => {
    if (!currentPeriod) return
    setLoading(true)
    try {
      const params: Record<string, string> = { periodId: currentPeriod.id }
      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      const res = await api.voucherSummary(currentPeriod.id, params.startDate, params.endDate)
      setData(res.data.data.rows)
      setTotalCount(res.data.data.totalVouchers)
      setAttachmentCount(res.data.data.totalAttachments)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [currentPeriod?.id])

  const periodStartDate = currentPeriod ? dayjs(currentPeriod.startDate) : dayjs()
  const periodEndDate = currentPeriod ? dayjs(currentPeriod.endDate) : dayjs()

  const columns: ColumnsType<SummaryRow> = [
    {
      title: '科目编码',
      dataIndex: 'accountCode',
      width: 200,
      render: (v: string) => <a style={{ color: '#1677ff' }}>{v}</a>,
    },
    {
      title: '科目名称',
      dataIndex: 'accountName',
      width: 300,
    },
    {
      title: '借方金额',
      dataIndex: 'debitAmount',
      width: 200,
      align: 'right',
      render: (v: number) => fmtAmount(v),
    },
    {
      title: '贷方金额',
      dataIndex: 'creditAmount',
      width: 200,
      align: 'right',
      render: (v: number) => fmtAmount(v),
    },
  ]

  return (
    <div style={{ background: '#fff', minHeight: '100%', margin: '-24px', display: 'flex', flexDirection: 'column' }}>
      <VoucherTabBar />

      {/* Filter bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Space>
          <Text type="secondary">汇总日期</Text>
          <RangePicker
            size="small"
            value={dateRange ?? [periodStartDate, periodEndDate]}
            onChange={v => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            format="YYYY-MM-DD"
          />
          <Button size="small" icon={<FilterOutlined />}>过滤</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
        <Space style={{ marginLeft: 16 }}>
          <Text type="secondary">凭证总张数: <Text strong>{totalCount}</Text>张;</Text>
          <Text type="secondary">附件总张数: <Text strong>{attachmentCount}</Text>张</Text>
        </Space>
      </div>

      {/* Table */}
      <div style={{ padding: '0 16px', flex: 1 }}>
        <Table
          rowKey="accountCode"
          columns={columns}
          dataSource={data}
          loading={loading}
          size="small"
          bordered
          pagination={false}
          style={{ marginTop: 8 }}
          components={{
            header: {
              cell: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                <th {...props} style={{ ...props.style as React.CSSProperties, background: '#e6f4ff', color: '#1677ff', fontWeight: 500 }} />
              ),
            },
          }}
        />
      </div>
    </div>
  )
}
