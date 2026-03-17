import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Tag, Input, Select, DatePicker, Card, Typography, Popconfirm, message, Row, Col } from 'antd'
import { PlusOutlined, SearchOutlined, CheckOutlined, RetweetOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api, type Voucher } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title } = Typography
const { RangePicker } = DatePicker

const STATUS_COLORS: Record<string, string> = {
  draft: 'default', pending: 'processing', approved: 'cyan', posted: 'success', reversed: 'error'
}
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', pending: '待审核', approved: '已审核', posted: '已记账', reversed: '已冲销'
}

export default function VoucherListPage() {
  const navigate = useNavigate()
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [data, setData] = useState<Voucher[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [filters, setFilters] = useState({ page: 1, pageSize: 20, status: '', keyword: '' })

  const fetchData = async () => {
    if (!currentPeriod) return
    setLoading(true)
    const res = await api.listVouchers({ ...filters, periodId: currentPeriod.id })
    setData(res.data.data)
    setTotal(res.data.total)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [currentPeriod?.id, filters])

  const handleBatchPost = async () => {
    const res = await api.batchPostVouchers(selected)
    message.success(res.data.message)
    setSelected([])
    fetchData()
  }

  const handleReverse = async (id: string) => {
    await api.reverseVoucher(id)
    message.success('反向冲销成功')
    fetchData()
  }

  const columns: ColumnsType<Voucher> = [
    { title: '凭证号', dataIndex: 'voucherNo', width: 160, render: (v, r) => <a onClick={() => navigate(`/vouchers/${r.id}`)}>{v}</a> },
    { title: '日期', dataIndex: 'voucherDate', width: 110 },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>
    },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'draft' && <Button size="small" type="link" onClick={async () => { await api.submitVoucher(r.id); fetchData() }}>提交</Button>}
          {r.status === 'pending' && <Button size="small" type="link" onClick={async () => { await api.approveVoucher(r.id); fetchData() }}>审核</Button>}
          {r.status === 'approved' && <Button size="small" type="link" onClick={async () => { await api.postVoucher(r.id); fetchData() }}>记账</Button>}
          {r.status === 'posted' && (
            <Popconfirm title="确认红字冲销此凭证？" onConfirm={() => handleReverse(r.id)}>
              <Button size="small" type="link" danger><RetweetOutlined />冲销</Button>
            </Popconfirm>
          )}
          <Button size="small" type="link" onClick={() => navigate(`/vouchers/${r.id}`)}>查看</Button>
        </Space>
      )
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>凭证管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vouchers/new')}>新增凭证</Button>
      </div>

      <Card size="small">
        <Row gutter={[12, 12]}>
          <Col flex="200px">
            <Input placeholder="凭证号/摘要搜索" prefix={<SearchOutlined />}
              onChange={e => setFilters(f => ({ ...f, keyword: e.target.value, page: 1 }))} allowClear />
          </Col>
          <Col flex="140px">
            <Select placeholder="状态" style={{ width: '100%' }} allowClear
              onChange={v => setFilters(f => ({ ...f, status: v ?? '', page: 1 }))}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
            </Select>
          </Col>
          <Col>
            <RangePicker size="middle" onChange={(_, s) => setFilters(f => ({ ...f, startDate: s[0], endDate: s[1], page: 1 } as typeof f))} />
          </Col>
          {selected.length > 0 && (
            <Col>
              <Button icon={<CheckOutlined />} onClick={handleBatchPost}>批量记账 ({selected.length})</Button>
            </Col>
          )}
        </Row>
      </Card>

      <Table
        className="voucher-table"
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 800 }}
        rowSelection={{ selectedRowKeys: selected, onChange: k => setSelected(k as string[]) }}
        pagination={{ current: filters.page, pageSize: filters.pageSize, total, showSizeChanger: true, showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => setFilters(f => ({ ...f, page: p, pageSize: ps })) }}
      />
    </Space>
  )
}
