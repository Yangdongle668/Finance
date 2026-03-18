import { useEffect, useState } from 'react'
import { Layout, Table, Button, Space, Typography, DatePicker, Select, Input, Tabs, Tree, Empty, Popconfirm, message, Modal, Dropdown } from 'antd'
import {
  ImportOutlined, LinkOutlined, SettingOutlined, CheckOutlined,
  DownloadOutlined, PrinterOutlined, ExportOutlined, DeleteOutlined,
  MoreOutlined, PlusOutlined, FolderOutlined, FileOutlined,
  FilterOutlined, ReloadOutlined, SearchOutlined,
  DoubleLeftOutlined, DoubleRightOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, type AttachmentItem, type AttachmentCategory } from '@/api/client'
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
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const periods = usePeriodStore(s => s.periods)

  const [categories, setCategories] = useState<AttachmentCategory[]>([])
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
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
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 })

  useEffect(() => {
    api.listAttachmentCategories().then(r => setCategories(r.data.data))
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        ...filters,
        name: nameFilter || undefined,
        categoryId: selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined,
      }
      const res = await api.listAttachments(params as never)
      setAttachments(res.data.data)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filters, selectedCategory, nameFilter])

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

  const treeData = buildCategoryTree(categories)

  const columns: ColumnsType<AttachmentItem> = [
    {
      title: '操作', width: 60,
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={async () => { await api.deleteAttachment(r.id); fetchData() }}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
    { title: '附件名称', dataIndex: 'name', sorter: true, ellipsis: true },
    { title: '附件备注', dataIndex: 'remark', sorter: true, ellipsis: true, render: v => v || '—' },
    {
      title: '附件小类', width: 100, sorter: true,
      render: (_, r) => {
        const cat = categories.find(c => c.id === r.categoryId)
        return cat?.name || '—'
      },
    },
    {
      title: '附件金额', dataIndex: 'amount', width: 120, align: 'right',
      render: (v: number) => v > 0 ? (v / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—',
    },
    { title: '凭证模板', width: 100, render: () => '—' },
    { title: '附件所属组', width: 120, render: () => '—' },
    {
      title: '是否识别', width: 90, align: 'center',
      render: () => '—',
    },
  ]

  return (
    <div style={{ background: '#fff', minHeight: '100%', margin: '-24px', display: 'flex', flexDirection: 'column' }}>
      <VoucherTabBar />

      {/* Filter bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Space>
          <Dropdown menu={{ items: [{ key: 'upload', label: '上传日期' }, { key: 'period', label: '记账期间' }] }}>
            <Button size="small">上传日期 ▾</Button>
          </Dropdown>
          <RangePicker size="small" />
          <Button size="small" icon={<FilterOutlined />}>过滤</Button>
        </Space>
        <Space>
          <Select
            size="small"
            defaultValue="name"
            style={{ width: 100 }}
            options={[{ value: 'name', label: '附件名称' }]}
          />
          <Input
            size="small"
            placeholder="附件名称"
            style={{ width: 160 }}
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
          <Dropdown menu={{ items: [{ key: 'local', label: '本地上传' }, { key: 'scan', label: '扫描导入' }] }}>
            <Button type="primary" size="small" icon={<ImportOutlined />}>导入</Button>
          </Dropdown>
          <Button size="small" icon={<LinkOutlined />}>关联凭证</Button>
          <Button size="small" icon={<SettingOutlined />}>分组设置</Button>
          <Dropdown menu={{ items: [{ key: 'approve', label: '批量审核' }, { key: 'unapprove', label: '取消审核' }] }}>
            <Button size="small">审核</Button>
          </Dropdown>
          <Button size="small" icon={<DownloadOutlined />}>下载</Button>
          <Dropdown menu={{ items: [{ key: 'print', label: '打印' }] }}>
            <Button size="small" icon={<PrinterOutlined />}>打印</Button>
          </Dropdown>
          <Button size="small" icon={<ExportOutlined />}>导出</Button>
          {selected.length > 0 && (
            <Popconfirm title={`确认删除 ${selected.length} 个附件？`} onConfirm={handleDelete}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
          <Dropdown menu={{ items: [{ key: 'merge', label: '合并附件' }, { key: 'split', label: '拆分附件' }] }}>
            <Button size="small">更多</Button>
          </Dropdown>
          <Button size="small">附件小类</Button>
          <Button type="primary" size="small" style={{ fontWeight: 500 }}>生成凭证</Button>
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
    </div>
  )
}
