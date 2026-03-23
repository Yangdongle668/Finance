import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Select, Typography, Popconfirm, message, Checkbox, Dropdown, Tooltip, Input, Modal } from 'antd'
import {
  PlusOutlined, FilterOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, MoreOutlined,
  CheckOutlined, PrinterOutlined, ImportOutlined, ExportOutlined,
  EyeOutlined, SearchOutlined, AuditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, type Voucher, type VoucherLine } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import VoucherTabBar from './VoucherTabBar'

const { Text } = Typography

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
        key: v.id, voucherId: v.id, voucherNo: v.voucherNo,
        voucherWord: v.voucherWord || '记', voucherDate: v.voucherDate,
        status: v.status, summary: v.summary, accountCode: '', accountName: '',
        debitAmount: 0, creditAmount: 0, attachmentCount: v.attachmentCount ?? 0,
        preparedBy: v.preparedBy, reviewedBy: v.reviewedBy ?? '',
        lineIndex: 0, lineCount: 1,
      })
    } else {
      lines.forEach((l: VoucherLine, i: number) => {
        rows.push({
          key: `${v.id}_${i}`, voucherId: v.id, voucherNo: v.voucherNo,
          voucherWord: v.voucherWord || '记', voucherDate: v.voucherDate,
          status: v.status, summary: l.remark || v.summary,
          accountCode: l.accountCode, accountName: l.accountName,
          debitAmount: l.direction === 'debit' ? l.amount / 100 : 0,
          creditAmount: l.direction === 'credit' ? l.amount / 100 : 0,
          attachmentCount: v.attachmentCount ?? 0,
          preparedBy: v.preparedBy, reviewedBy: v.reviewedBy ?? '',
          lineIndex: i, lineCount: lines.length,
        })
      })
    }
  }
  return rows
}

const fmtAmount = (v: number) => v > 0 ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

const STATUS_LABELS: Record<string, string> = { draft: '草稿', pending: '待审核', approved: '已审核', posted: '已记账', reversed: '已冲销' }

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
  const [showFilter, setShowFilter] = useState(false)

  const startPeriodId = periodRange[0] || currentPeriod?.id || ''
  const endPeriodId = periodRange[1] || currentPeriod?.id || ''
  const startP = periods.find(p => p.id === startPeriodId)
  const endP = periods.find(p => p.id === endPeriodId)
  const isMultiPeriod = startPeriodId !== endPeriodId

  const fetchData = useCallback(async () => {
    if (!currentPeriod) return
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        page: filters.page,
        pageSize: filters.pageSize,
        includeLines: true,
      }
      if (filters.status) params.status = filters.status
      if (filters.keyword) params.keyword = filters.keyword

      if (isMultiPeriod) {
        // Cross-period query: use date range, no single periodId
        if (startP) params.startDate = startP.startDate
        if (endP) params.endDate = endP.endDate
      } else {
        // Single period query: just use periodId
        params.periodId = startPeriodId
      }

      const res = await api.listVouchers(params as never)
      setData(res.data.data)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [currentPeriod, filters, startPeriodId, endPeriodId, isMultiPeriod, startP, endP])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    await api.deleteVoucher(id)
    message.success('凭证已删除')
    fetchData()
  }

  const handleBatchApprove = async () => {
    const voucherIds = [...new Set(selected.map(k => k.split('_')[0]))]
    let success = 0, fail = 0
    for (const vid of voucherIds) {
      try {
        const row = flatRows.find(r => r.voucherId === vid && r.lineIndex === 0)
        if (row?.status === 'draft') {
          await api.submitVoucher(vid)
        }
        await api.approveVoucher(vid)
        success++
      } catch { fail++ }
    }
    if (fail > 0) message.warning(`审核完成：成功 ${success} 张，失败 ${fail} 张`)
    else message.success(`成功审核 ${success} 张凭证`)
    setSelected([])
    fetchData()
  }

  const handleBatchUnapprove = async () => {
    const voucherIds = [...new Set(selected.map(k => k.split('_')[0]))]
    let success = 0
    for (const vid of voucherIds) {
      try { await api.rejectVoucher(vid); success++ } catch { /* skip */ }
    }
    message.success(`成功取消审核 ${success} 张凭证`)
    setSelected([])
    fetchData()
  }

  const handleBatchPost = async () => {
    const voucherIds = [...new Set(selected.map(k => k.split('_')[0]))]
    let success = 0, fail = 0
    // 一键记账：自动将草稿→提交→审核→记账
    for (const vid of voucherIds) {
      try {
        const row = flatRows.find(r => r.voucherId === vid && r.lineIndex === 0)
        if (row?.status === 'draft') {
          await api.submitVoucher(vid)
          await api.approveVoucher(vid)
        } else if (row?.status === 'pending') {
          await api.approveVoucher(vid)
        }
        await api.postVoucher(vid)
        success++
      } catch { fail++ }
    }
    if (fail > 0) message.warning(`记账完成：成功 ${success} 张，失败 ${fail} 张`)
    else message.success(`成功记账 ${success} 张凭证`)
    setSelected([])
    fetchData()
  }

  const handlePostAll = async () => {
    const unpostedIds = [...new Set(
      flatRows.filter(r => r.status !== 'posted' && r.status !== 'reversed').map(r => r.voucherId)
    )]
    if (unpostedIds.length === 0) { message.info('当前视图内没有未记账凭证'); return }
    let success = 0, fail = 0
    for (const vid of unpostedIds) {
      try {
        const row = flatRows.find(r => r.voucherId === vid && r.lineIndex === 0)
        if (row?.status === 'draft') {
          await api.submitVoucher(vid)
          await api.approveVoucher(vid)
        } else if (row?.status === 'pending') {
          await api.approveVoucher(vid)
        }
        await api.postVoucher(vid)
        success++
      } catch { fail++ }
    }
    if (fail > 0) message.warning(`记账完成：成功 ${success} 张，失败 ${fail} 张`)
    else message.success(`成功记账 ${success} 张凭证，账簿数据已更新`)
    fetchData()
  }

  const handleBatchDelete = async () => {
    const voucherIds = [...new Set(selected.map(k => k.split('_')[0]))]
    let success = 0
    for (const vid of voucherIds) {
      try { await api.deleteVoucher(vid); success++ } catch { /* skip */ }
    }
    message.success(`成功删除 ${success} 张凭证`)
    setSelected([])
    fetchData()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    const headers = ['日期', '凭证字号', '摘要', '科目编码', '科目名称', '借方金额', '贷方金额']
    const rows = flatRows.map(r => [
      r.voucherDate, r.voucherNo, r.summary, r.accountCode, r.accountName,
      r.debitAmount > 0 ? r.debitAmount.toFixed(2) : '',
      r.creditAmount > 0 ? r.creditAmount.toFixed(2) : '',
    ])
    const csvContent = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `凭证_${startP?.name || ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  const flatRows = flattenVouchers(data)
  const totalDebit = flatRows.reduce((s, r) => s + r.debitAmount, 0)
  const totalCredit = flatRows.reduce((s, r) => s + r.creditAmount, 0)

  const startPeriodLabel = startP ? `${startP.year}年${String(startP.month).padStart(2, '0')}期` : ''
  const endPeriodLabel = endP ? `${endP.year}年${String(endP.month).padStart(2, '0')}期` : ''

  const columns: ColumnsType<FlatRow> = [
    {
      title: '操作', width: 80, fixed: 'left',
      render: (_, r) => {
        if (r.lineIndex > 0) return null
        return (
          <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
            <a onClick={() => navigate(`/vouchers/${r.voucherId}/edit`)} style={{ color: '#1677ff' }}>
              <EditOutlined />
            </a>
            {r.status === 'draft' && (
              <Popconfirm title="确认删除此凭证？" onConfirm={() => handleDelete(r.voucherId)}>
                <a style={{ color: '#ff4d4f' }}><DeleteOutlined /></a>
              </Popconfirm>
            )}
            <Dropdown menu={{ items: [
              { key: 'view', label: '查看详情', onClick: () => navigate(`/vouchers/${r.voucherId}`) },
              ...(r.status === 'draft' ? [{ key: 'submit', label: '提交审核', onClick: async () => { await api.submitVoucher(r.voucherId); message.success('已提交审核'); fetchData() } }] : []),
              ...(r.status === 'pending' ? [
                { key: 'approve', label: '审核通过', onClick: async () => { await api.approveVoucher(r.voucherId); message.success('审核通过'); fetchData() } },
                { key: 'reject', label: '驳回', onClick: async () => { await api.rejectVoucher(r.voucherId); message.success('已驳回'); fetchData() } },
              ] : []),
              ...(r.status === 'approved' ? [{ key: 'post', label: '记账', onClick: async () => { await api.postVoucher(r.voucherId); message.success('记账成功'); fetchData() } }] : []),
              ...(r.status === 'posted' ? [{ key: 'reverse', label: '红字冲销', onClick: async () => { await api.reverseVoucher(r.voucherId); message.success('冲销成功'); fetchData() } }] : []),
            ] }}>
              <a><MoreOutlined /></a>
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
      title: '凭证字号', width: 100, sorter: true,
      render: (_, r) => (
        <a onClick={() => navigate(`/vouchers/${r.voucherId}`)} style={{ color: '#1677ff' }}>
          {r.voucherNo}
        </a>
      ),
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '科目', ellipsis: true,
      render: (_, r) => r.accountCode ? `${r.accountCode} ${r.accountName}` : '',
    },
    {
      title: '借方金额', dataIndex: 'debitAmount', width: 130, align: 'right',
      render: (v: number) => <Text>{fmtAmount(v)}</Text>,
    },
    {
      title: '贷方金额', dataIndex: 'creditAmount', width: 130, align: 'right',
      render: (v: number) => <Text>{fmtAmount(v)}</Text>,
    },
    {
      title: '状态', width: 80, align: 'center',
      render: (_, r) => r.lineIndex === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>{STATUS_LABELS[r.status] || r.status}</Text> : null,
      onCell: (r) => ({ rowSpan: r.lineIndex === 0 ? r.lineCount : 0 }),
    },
  ]

  return (
    <div style={{ background: '#fff', minHeight: '100%', margin: '-24px', display: 'flex', flexDirection: 'column' }}>
      <VoucherTabBar />

      {/* Combined filter + action bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Select
            size="small"
            style={{ width: 130 }}
            value={startPeriodId}
            onChange={v => setPeriodRange([v, periodRange[1] || v])}
            options={periods.map(p => ({ value: p.id, label: p.name }))}
          />
          <Text type="secondary">~</Text>
          <Select
            size="small"
            style={{ width: 130 }}
            value={endPeriodId}
            onChange={v => setPeriodRange([periodRange[0] || v, v])}
            options={periods.map(p => ({ value: p.id, label: p.name }))}
          />
          <Button size="small" icon={<FilterOutlined />} onClick={() => setShowFilter(!showFilter)}>过滤</Button>
          <Checkbox checked={showSubtotal} onChange={e => setShowSubtotal(e.target.checked)}>
            <Text style={{ fontSize: 13 }}>显示凭证金额小计</Text>
          </Checkbox>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>

        <Space wrap>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => navigate('/vouchers/new')}>新增</Button>
          <Dropdown menu={{ items: [
            { key: 'approve', label: '批量审核', onClick: handleBatchApprove },
            { key: 'unapprove', label: '取消审核', onClick: handleBatchUnapprove },
          ] }}>
            <Button size="small" icon={<CheckOutlined />}>审核</Button>
          </Dropdown>
          {(() => {
            const unpostedCount = new Set(
              flatRows.filter(r => r.status !== 'posted' && r.status !== 'reversed').map(r => r.voucherId)
            ).size
            return (
              <Button
                size="small"
                icon={<AuditOutlined />}
                onClick={selected.length > 0 ? handleBatchPost : handlePostAll}
                style={unpostedCount > 0 ? { color: '#fa8c16', borderColor: '#fa8c16' } : {}}
              >
                记账{unpostedCount > 0 ? `（${unpostedCount}）` : ''}
              </Button>
            )
          })()}
          <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Dropdown menu={{ items: [
            { key: 'excel', label: '导出CSV', onClick: handleExportExcel },
          ] }}>
            <Button size="small" icon={<ExportOutlined />}>导出</Button>
          </Dropdown>
          {selected.length > 0 && (
            <Popconfirm title={`确认删除 ${selected.length} 张凭证？`} onConfirm={handleBatchDelete}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
          <Dropdown menu={{ items: [
            { key: 'batch-post', label: '批量记账', onClick: handleBatchPost },
            { key: 'batch-delete', label: '批量删除', onClick: () => {
              if (selected.length === 0) { message.warning('请先选择凭证'); return }
              Modal.confirm({ title: '确认批量删除？', content: `即将删除 ${selected.length} 张凭证`, onOk: handleBatchDelete })
            }},
          ] }}>
            <Button size="small">更多</Button>
          </Dropdown>
        </Space>
      </div>

      {/* Filter row */}
      {showFilter && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>状态</Text>
            <Select
              size="small"
              style={{ width: 120 }}
              value={filters.status}
              onChange={v => setFilters(f => ({ ...f, status: v, page: 1 }))}
              allowClear
              placeholder="全部"
              options={[
                { value: '', label: '全部' },
                { value: 'draft', label: '草稿' },
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已审核' },
                { value: 'posted', label: '已记账' },
                { value: 'reversed', label: '已冲销' },
              ]}
            />
          </Space>
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>关键字</Text>
            <Input
              size="small"
              style={{ width: 180 }}
              placeholder="凭证号/摘要"
              value={filters.keyword}
              onChange={e => setFilters(f => ({ ...f, keyword: e.target.value, page: 1 }))}
              allowClear
              suffix={<SearchOutlined style={{ color: '#999' }} />}
            />
          </Space>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, padding: '0 16px' }}>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={flatRows}
          loading={loading}
          size="small"
          scroll={{ x: 1100 }}
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
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong>{fmtAmount(totalDebit)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <Text strong>{fmtAmount(totalCredit)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>
    </div>
  )
}
