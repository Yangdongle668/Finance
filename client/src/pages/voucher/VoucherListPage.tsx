import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Input, Select, Card, Typography, Popconfirm, message, Row, Col, Checkbox, Dropdown } from 'antd'
import {
  PlusOutlined, FilterOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, MoreOutlined,
  CheckOutlined, PrinterOutlined, ImportOutlined, ExportOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, type Voucher, type VoucherLine } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Text } = Typography

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', pending: '待审核', approved: '已审核', posted: '已记账', reversed: '已冲销'
}

/** Flatten voucher + lines into table rows for multi-line display */
interface FlatRow {
  key: string
  voucherId: string
  voucherNo: string
  voucherWord: string
  voucherDate: string
  status: string
  summary: string
  accountCode: string
  accountName: string
  debitAmount: number
  creditAmount: number
  attachmentCount: number
  preparedBy: string
  reviewedBy: string
  lineIndex: number
  lineCount: number
}

function flattenVouchers(vouchers: Voucher[]): FlatRow[] {
  const rows: FlatRow[] = []
  for (const v of vouchers) {
    const lines = v.lines ?? []
    if (lines.length === 0) {
      rows.push({
        key: v.id,
        voucherId: v.id,
        voucherNo: v.voucherNo,
        voucherWord: v.voucherWord || '记',
        voucherDate: v.voucherDate,
        status: v.status,
        summary: v.summary,
        accountCode: '',
        accountName: '',
        debitAmount: 0,
        creditAmount: 0,
        attachmentCount: v.attachmentCount ?? 0,
        preparedBy: v.preparedBy,
        reviewedBy: v.reviewedBy ?? '',
        lineIndex: 0,
        lineCount: 1,
      })
    } else {
      lines.forEach((l: VoucherLine, i: number) => {
        rows.push({
          key: `${v.id}_${i}`,
          voucherId: v.id,
          voucherNo: v.voucherNo,
          voucherWord: v.voucherWord || '记',
          voucherDate: v.voucherDate,
          status: v.status,
          summary: l.remark || v.summary,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debitAmount: l.direction === 'debit' ? l.amount / 100 : 0,
          creditAmount: l.direction === 'credit' ? l.amount / 100 : 0,
          attachmentCount: v.attachmentCount ?? 0,
          preparedBy: v.preparedBy,
          reviewedBy: v.reviewedBy ?? '',
          lineIndex: i,
          lineCount: lines.length,
        })
      })
    }
  }
  return rows
}

const fmtAmount = (v: number) => v > 0 ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

export default function VoucherListPage() {
  const navigate = useNavigate()
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const periods = usePeriodStore(s => s.periods)
  const [data, setData] = useState<Voucher[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [showSubtotal, setShowSubtotal] = useState(false)
  const [filters, setFilters] = useState({ page: 1, pageSize: 20, status: '', keyword: '' })
  const [periodRange, setPeriodRange] = useState<[string, string]>(['', ''])

  const fetchData = async () => {
    if (!currentPeriod) return
    setLoading(true)
    try {
      const startPeriod = periodRange[0] || currentPeriod.id
      const endPeriod = periodRange[1] || currentPeriod.id
      const startP = periods.find(p => p.id === startPeriod)
      const endP = periods.find(p => p.id === endPeriod)
      const res = await api.listVouchers({
        ...filters,
        periodId: currentPeriod.id,
        startDate: startP?.startDate,
        endDate: endP?.endDate,
        includeLines: true,
      })
      setData(res.data.data)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [currentPeriod?.id, filters])

  const handleDelete = async (id: string) => {
    await api.deleteVoucher(id)
    message.success('凭证已删除')
    fetchData()
  }

  const flatRows = flattenVouchers(data)
  const totalDebit = flatRows.reduce((s, r) => s + r.debitAmount, 0)
  const totalCredit = flatRows.reduce((s, r) => s + r.creditAmount, 0)

  const columns: ColumnsType<FlatRow> = [
    {
      title: '操作', width: 90, fixed: 'left',
      render: (_, r) => {
        if (r.lineIndex > 0) return null
        return (
          <Space size={2}>
            <Button size="small" type="text" icon={<EditOutlined />}
              onClick={() => navigate(`/vouchers/${r.voucherId}/edit`)} />
            {r.status === 'draft' && (
              <Popconfirm title="确认删除此凭证？" onConfirm={() => handleDelete(r.voucherId)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
            <Dropdown menu={{ items: [
              { key: 'view', label: '查看详情', onClick: () => navigate(`/vouchers/${r.voucherId}`) },
              ...(r.status === 'draft' ? [{ key: 'submit', label: '提交审核', onClick: async () => { await api.submitVoucher(r.voucherId); fetchData() } }] : []),
              ...(r.status === 'pending' ? [{ key: 'approve', label: '审核通过', onClick: async () => { await api.approveVoucher(r.voucherId); fetchData() } }] : []),
            ] }}>
              <Button size="small" type="text" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        )
      },
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
    {
      title: '日期', dataIndex: 'voucherDate', width: 110, sorter: true,
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
    {
      title: '凭证字号', width: 100,
      render: (_, r) => (
        <a onClick={() => navigate(`/vouchers/${r.voucherId}`)} style={{ color: '#1677ff' }}>
          {r.voucherNo}
        </a>
      ),
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
    {
      title: '摘要', dataIndex: 'summary', ellipsis: true, width: 180,
    },
    {
      title: '科目', width: 200, ellipsis: true,
      render: (_, r) => r.accountCode ? `${r.accountCode} ${r.accountName}` : '',
    },
    {
      title: '借方金额', dataIndex: 'debitAmount', width: 130, align: 'right',
      render: (v: number) => <Text style={{ color: v > 0 ? '#d4380d' : undefined }}>{fmtAmount(v)}</Text>,
    },
    {
      title: '贷方金额', dataIndex: 'creditAmount', width: 130, align: 'right',
      render: (v: number) => <Text style={{ color: v > 0 ? '#389e0d' : undefined }}>{fmtAmount(v)}</Text>,
    },
    {
      title: '附件', width: 80,
      render: (_, r) => r.lineIndex === 0 ? <a>上传附件</a> : null,
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
    {
      title: '制单人', dataIndex: 'preparedBy', width: 80,
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
    {
      title: '审核人', dataIndex: 'reviewedBy', width: 80,
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Filter bar */}
      <Card size="small" bodyStyle={{ padding: '8px 16px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Text type="secondary">凭证期间:</Text>
              <Select
                style={{ width: 140 }}
                size="small"
                value={periodRange[0] || currentPeriod?.id}
                onChange={v => setPeriodRange([v, periodRange[1] || v])}
                options={periods.map(p => ({ value: p.id, label: p.name }))}
              />
              <Text type="secondary">~</Text>
              <Select
                style={{ width: 140 }}
                size="small"
                value={periodRange[1] || currentPeriod?.id}
                onChange={v => setPeriodRange([periodRange[0] || v, v])}
                options={periods.map(p => ({ value: p.id, label: p.name }))}
              />
              <Button size="small" icon={<FilterOutlined />}>过滤</Button>
              <Checkbox checked={showSubtotal} onChange={e => setShowSubtotal(e.target.checked)}>
                <Text style={{ fontSize: 13 }}>显示凭证金额小计</Text>
              </Checkbox>
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            </Space>
          </Col>
          <Col>
            <Input
              size="small"
              placeholder="搜索凭证号/摘要"
              style={{ width: 180 }}
              allowClear
              onChange={e => setFilters(f => ({ ...f, keyword: e.target.value, page: 1 }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Action bar */}
      <Row justify="space-between" align="middle">
        <Col>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vouchers/new')}>新增</Button>
            <Dropdown menu={{ items: [
              { key: 'approve', label: '批量审核' },
              { key: 'unapprove', label: '取消审核' },
            ] }}>
              <Button icon={<CheckOutlined />}>审核</Button>
            </Dropdown>
            <Dropdown menu={{ items: [{ key: 'print', label: '打印凭证' }] }}>
              <Button icon={<PrinterOutlined />}>打印</Button>
            </Dropdown>
            <Button icon={<ImportOutlined />}>导入</Button>
            <Dropdown menu={{ items: [{ key: 'excel', label: '导出Excel' }, { key: 'pdf', label: '导出PDF' }] }}>
              <Button icon={<ExportOutlined />}>导出</Button>
            </Dropdown>
            {selected.length > 0 && (
              <Popconfirm title={`确认删除 ${selected.length} 张凭证？`} onConfirm={async () => {
                for (const id of selected) { try { await api.deleteVoucher(id) } catch { /* skip */ } }
                setSelected([])
                fetchData()
              }}>
                <Button danger icon={<DeleteOutlined />}>删除 ({selected.length})</Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
        <Col>
          <Select
            size="small"
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, status: v ?? '', page: 1 }))}
            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        </Col>
      </Row>

      {/* Table */}
      <Table
        rowKey="key"
        columns={columns}
        dataSource={flatRows}
        loading={loading}
        size="small"
        scroll={{ x: 1400 }}
        bordered
        rowSelection={{
          selectedRowKeys: selected,
          onChange: keys => setSelected(keys as string[]),
          getCheckboxProps: r => ({ disabled: r.lineIndex > 0 }),
        }}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条凭证`,
          onChange: (p, ps) => setFilters(f => ({ ...f, page: p, pageSize: ps })),
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: '#f6ffed' }}>
              <Table.Summary.Cell index={0} colSpan={6}>
                <Text strong style={{ color: '#52c41a' }}>合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                <Text strong style={{ color: '#d4380d' }}>{fmtAmount(totalDebit)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <Text strong style={{ color: '#389e0d' }}>{fmtAmount(totalCredit)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} colSpan={3} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </Space>
  )
}
