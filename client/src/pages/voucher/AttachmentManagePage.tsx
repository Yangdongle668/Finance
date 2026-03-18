import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Table, Button, Space, Typography, DatePicker, Select, Input, Tabs, Tree, Empty, Popconfirm, message, Modal, Dropdown, Form, InputNumber } from 'antd'
import {
  ImportOutlined, LinkOutlined, SettingOutlined,
  DownloadOutlined, PrinterOutlined, ExportOutlined, DeleteOutlined,
  PlusOutlined, FolderOutlined, FileOutlined,
  FilterOutlined, ReloadOutlined, SearchOutlined,
  DoubleLeftOutlined, DoubleRightOutlined, FileAddOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api, type AttachmentItem, type AttachmentCategory, type Voucher } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import VoucherTabBar from './VoucherTabBar'

const { Sider, Content } = Layout
const { Text } = Typography
const { RangePicker } = DatePicker

interface TreeNode {
  title: string
  key: string
  icon: React.ReactNode
  children?: TreeNode[]
}

function buildCategoryTree(categories: AttachmentCategory[]): TreeNode[] {
  const map = new Map<string | null, AttachmentCategory[]>()
  for (const c of categories) {
    const parent = c.parentId ?? null
    if (!map.has(parent)) map.set(parent, [])
    map.get(parent)!.push(c)
  }

  function build(parentId: string | null): TreeNode[] {
    const children = map.get(parentId) ?? []
    return children.map(c => {
      const subs = build(c.id)
      return {
        title: c.name,
        key: c.id,
        icon: subs.length > 0 ? <FolderOutlined style={{ color: '#1677ff' }} /> : <FileOutlined />,
        children: subs.length > 0 ? subs : undefined,
      }
    })
  }

  return [{
    title: '全部',
    key: 'all',
    icon: <FolderOutlined style={{ color: '#1677ff' }} />,
    children: build(null),
  }]
}

export default function AttachmentManagePage() {
  const navigate = useNavigate()
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const periods = usePeriodStore(s => s.periods)

  const [categories, setCategories] = useState<AttachmentCategory[]>([])
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('category')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [nameFilter, setNameFilter] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [linkVoucherId, setLinkVoucherId] = useState<string>('')
  const [importForm] = Form.useForm()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 })

  useEffect(() => {
    api.listAttachmentCategories().then(r => setCategories(r.data.data))
    if (currentPeriod) {
      api.listVouchers({ periodId: currentPeriod.id, pageSize: 1000 }).then(r => setVouchers(r.data.data))
    }
  }, [currentPeriod?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        ...filters,
        name: nameFilter || undefined,
        categoryId: selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined,
      }
      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      const res = await api.listAttachments(params as never)
      setAttachments(res.data.data)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filters, selectedCategory, nameFilter, dateRange])

  const handleDelete = async () => {
    for (const id of selected) {
      try { await api.deleteAttachment(id) } catch { /* skip */ }
    }
    message.success(`已删除 ${selected.length} 个附件`)
    setSelected([])
    fetchData()
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    await api.createAttachmentCategory({
      name: newCategoryName.trim(),
      parentId: selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined,
    })
    message.success('分类创建成功')
    setNewCategoryName('')
    setShowNewCategory(false)
    const r = await api.listAttachmentCategories()
    setCategories(r.data.data)
  }

  /** 导入（录入）附件信息 */
  const handleImport = async () => {
    try {
      const values = await importForm.validateFields()
      await api.createAttachment({
        name: values.name,
        remark: values.remark,
        categoryId: values.categoryId || null,
        amount: values.amount ? Math.round(values.amount * 100) : 0,
        periodId: currentPeriod?.id || null,
        uploadDate: dayjs().format('YYYY-MM-DD'),
      })
      message.success('附件录入成功')
      importForm.resetFields()
      setShowImport(false)
      fetchData()
    } catch { /* form validation error */ }
  }

  /** 批量关联凭证 */
  const handleLinkVoucher = async () => {
    if (!linkVoucherId) { message.warning('请选择要关联的凭证'); return }
    let success = 0
    for (const id of selected) {
      try { await api.linkAttachment(id, linkVoucherId); success++ } catch { /* skip */ }
    }
    message.success(`成功关联 ${success} 个附件到凭证`)
    setShowLink(false)
    setLinkVoucherId('')
    setSelected([])
    fetchData()
  }

  /** 取消关联凭证 */
  const handleUnlinkVoucher = async () => {
    let success = 0
    for (const id of selected) {
      try { await api.linkAttachment(id, null); success++ } catch { /* skip */ }
    }
    message.success(`成功取消关联 ${success} 个附件`)
    setSelected([])
    fetchData()
  }

  /** 导出CSV */
  const handleExport = () => {
    const headers = ['附件名称', '附件备注', '附件分类', '金额', '关联凭证', '上传日期']
    const rows = attachments.map(a => {
      const cat = categories.find(c => c.id === a.categoryId)
      const voucher = vouchers.find(v => v.id === a.voucherId)
      return [
        a.name, a.remark || '', cat?.name || '', a.amount > 0 ? (a.amount / 100).toFixed(2) : '',
        voucher?.voucherNo || '', a.uploadDate,
      ]
    })
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `原始凭证_${dayjs().format('YYYYMMDD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  /** 从选中附件生成凭证 */
  const handleGenerateVoucher = () => {
    if (selected.length === 0) { message.warning('请先选择附件'); return }
    navigate('/vouchers/new')
    message.info('请在凭证录入页面填写凭证信息，并关联附件')
  }

  const treeData = buildCategoryTree(categories)

  const columns: ColumnsType<AttachmentItem> = [
    {
      title: '操作', width: 80, fixed: 'left',
      render: (_, r) => (
        <Space>
          <Popconfirm title="确认删除？" onConfirm={async () => { await api.deleteAttachment(r.id); fetchData() }}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
          <Button
            size="small"
            type="text"
            icon={<LinkOutlined />}
            title="关联凭证"
            onClick={() => { setSelected([r.id]); setShowLink(true) }}
          />
        </Space>
      ),
    },
    { title: '附件名称', dataIndex: 'name', sorter: true, ellipsis: true },
    { title: '附件备注', dataIndex: 'remark', ellipsis: true, render: (v: string | null) => v || '—' },
    {
      title: '附件小类', width: 120,
      render: (_, r) => {
        const cat = categories.find(c => c.id === r.categoryId)
        return cat?.name || '—'
      },
    },
    {
      title: '附件金额', dataIndex: 'amount', width: 120, align: 'right' as const,
      render: (v: number) => v > 0 ? (v / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—',
    },
    {
      title: '关联凭证', width: 120,
      render: (_, r) => {
        const v = vouchers.find(v => v.id === r.voucherId)
        return v ? <a style={{ color: '#1677ff' }}>{v.voucherNo}</a> : '—'
      },
    },
    { title: '上传日期', dataIndex: 'uploadDate', width: 110 },
  ]

  return (
    <div style={{ background: '#fff', minHeight: '100%', margin: '-24px', display: 'flex', flexDirection: 'column' }}>
      <VoucherTabBar />

      {/* Filter bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 13 }}>上传日期</Text>
          <DatePicker.RangePicker
            size="small"
            value={dateRange}
            onChange={v => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            format="YYYY-MM-DD"
          />
          <Button size="small" icon={<FilterOutlined />} onClick={fetchData}>过滤</Button>
        </Space>
        <Space>
          <Input
            size="small"
            placeholder="附件名称"
            style={{ width: 180 }}
            allowClear
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            suffix={<SearchOutlined style={{ color: '#999' }} />}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
      </div>

      {/* Action bar */}
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button type="primary" size="small" icon={<ImportOutlined />} onClick={() => setShowImport(true)}>导入附件</Button>
          <Button
            size="small"
            icon={<LinkOutlined />}
            disabled={selected.length === 0}
            onClick={() => setShowLink(true)}
          >
            关联凭证
          </Button>
          <Button
            size="small"
            icon={<LinkOutlined />}
            disabled={selected.length === 0}
            onClick={handleUnlinkVoucher}
          >
            取消关联
          </Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          {selected.length > 0 && (
            <Popconfirm title={`确认删除 ${selected.length} 个附件？`} onConfirm={handleDelete}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            size="small"
            icon={<FileAddOutlined />}
            style={{ fontWeight: 500 }}
            onClick={handleGenerateVoucher}
          >
            生成凭证
          </Button>
        </Space>
      </div>

      {/* Main content: left panel + right table */}
      <Layout style={{ background: '#fff', borderTop: '1px solid #f0f0f0', flex: 1 }}>
        <Sider
          width={220}
          collapsedWidth={0}
          collapsed={collapsed}
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0', position: 'relative' }}
        >
          <div style={{ padding: 8 }}>
            <Tabs
              size="small"
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                { key: 'category', label: '附件小类' },
                { key: 'period', label: '记账期间' },
              ]}
            />
            {activeTab === 'category' && (
              <>
                <Input
                  size="small"
                  placeholder="请输入名称"
                  prefix={<SearchOutlined style={{ color: '#999' }} />}
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <Tree
                  showIcon
                  treeData={treeData}
                  defaultExpandAll
                  selectedKeys={selectedCategory ? [selectedCategory] : ['all']}
                  onSelect={keys => setSelectedCategory((keys[0] as string) || '')}
                  style={{ marginTop: 4 }}
                />
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => setShowNewCategory(true)}
                >
                  新增附件小类
                </Button>
              </>
            )}
            {activeTab === 'period' && (
              <div style={{ marginTop: 8 }}>
                {periods.map(p => (
                  <div
                    key={p.id}
                    style={{
                      padding: '4px 8px', cursor: 'pointer', borderRadius: 4,
                      background: selectedCategory === p.id ? '#e6f4ff' : 'transparent',
                    }}
                    onClick={() => setSelectedCategory(p.id)}
                  >
                    <Text style={{ fontSize: 13 }}>{p.name}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Collapse toggle */}
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'absolute', top: '50%', right: -14, transform: 'translateY(-50%)',
              cursor: 'pointer', zIndex: 10, color: '#999', background: '#fff',
              border: '1px solid #e8e8e8', borderRadius: 2, padding: '4px 2px',
              display: 'flex', alignItems: 'center',
            }}
          >
            {collapsed ? <DoubleRightOutlined style={{ fontSize: 10 }} /> : <DoubleLeftOutlined style={{ fontSize: 10 }} />}
          </div>
        </Sider>

        <Content style={{ padding: 12 }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={attachments}
            loading={loading}
            size="small"
            scroll={{ x: 1000 }}
            rowSelection={{
              selectedRowKeys: selected,
              onChange: keys => setSelected(keys as string[]),
            }}
            pagination={{
              current: filters.page,
              pageSize: filters.pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => setFilters({ page: p, pageSize: ps }),
            }}
            locale={{
              emptyText: <Empty description="暂无数据" />,
            }}
          />
        </Content>
      </Layout>

      {/* New category modal */}
      <Modal
        title="新增附件小类"
        open={showNewCategory}
        onOk={handleAddCategory}
        onCancel={() => { setShowNewCategory(false); setNewCategoryName('') }}
        width={360}
      >
        <Input
          placeholder="分类名称"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          onPressEnter={handleAddCategory}
        />
      </Modal>

      {/* Import attachment modal */}
      <Modal
        title="录入原始凭证"
        open={showImport}
        onOk={handleImport}
        onCancel={() => { setShowImport(false); importForm.resetFields() }}
        width={480}
        okText="保存"
      >
        <Form form={importForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="附件名称" name="name" rules={[{ required: true, message: '请输入附件名称' }]}>
            <Input placeholder="例如：增值税专用发票" />
          </Form.Item>
          <Form.Item label="附件备注" name="remark">
            <Input placeholder="附件说明（可选）" />
          </Form.Item>
          <Form.Item label="附件小类" name="categoryId">
            <Select
              allowClear
              placeholder="选择分类（可选）"
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item label="附件金额（元）" name="amount">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="0.00"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Link voucher modal */}
      <Modal
        title={`关联凭证（已选 ${selected.length} 个附件）`}
        open={showLink}
        onOk={handleLinkVoucher}
        onCancel={() => { setShowLink(false); setLinkVoucherId('') }}
        width={480}
        okText="关联"
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">选择要关联的凭证：</Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="请选择凭证"
          showSearch
          value={linkVoucherId || undefined}
          onChange={setLinkVoucherId}
          optionFilterProp="label"
          options={vouchers.map(v => ({
            value: v.id,
            label: `${v.voucherNo} - ${v.voucherDate} - ${v.summary}`,
          }))}
        />
      </Modal>
    </div>
  )
}
