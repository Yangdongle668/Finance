import { useEffect, useState } from 'react'
import { Layout, Table, Button, Space, Typography, DatePicker, Select, Input, Tabs, Tree, Empty, Popconfirm, message, Card, Row, Col, Modal } from 'antd'
import {
  ImportOutlined, LinkOutlined, SettingOutlined, CheckOutlined,
  DownloadOutlined, PrinterOutlined, ExportOutlined, DeleteOutlined,
  MoreOutlined, PlusOutlined, FolderOutlined, FileOutlined,
  FilterOutlined, LeftOutlined, RightOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, type AttachmentItem, type AttachmentCategory } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Sider, Content } = Layout
const { Text, Title } = Typography
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

  return [
    {
      title: '全部',
      key: 'all',
      icon: <FolderOutlined style={{ color: '#1677ff' }} />,
      children: build(null),
    },
  ]
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
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 })

  // Load categories
  useEffect(() => {
    api.listAttachmentCategories().then(r => setCategories(r.data.data))
  }, [])

  // Load attachments
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
        <Space size={2}>
          <Popconfirm title="确认删除？" onConfirm={async () => { await api.deleteAttachment(r.id); fetchData() }}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
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
    { title: '附件所属期间', dataIndex: 'periodId', width: 130, render: (v: string) => {
      const p = periods.find(p => p.id === v)
      return p?.name || v || '—'
    }},
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Filter bar */}
      <Card size="small" bodyStyle={{ padding: '8px 16px' }}>
        <Row gutter={12} align="middle">
          <Col>
            <Space>
              <Text type="secondary">上传日期:</Text>
              <RangePicker size="small" />
              <Button size="small" icon={<FilterOutlined />}>过滤</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">附件名称:</Text>
              <Input
                size="small"
                placeholder="搜索附件名称"
                style={{ width: 160 }}
                allowClear
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Action bar */}
      <Space wrap>
        <Button type="primary" icon={<ImportOutlined />}>导入</Button>
        <Button icon={<LinkOutlined />}>关联凭证</Button>
        <Button icon={<SettingOutlined />}>分组设置</Button>
        <Button icon={<CheckOutlined />}>审核</Button>
        <Button icon={<DownloadOutlined />}>下载</Button>
        <Button icon={<PrinterOutlined />}>打印</Button>
        <Button icon={<ExportOutlined />}>导出</Button>
        {selected.length > 0 && (
          <Popconfirm title={`确认删除 ${selected.length} 个附件？`} onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>删除 ({selected.length})</Button>
          </Popconfirm>
        )}
        <Button icon={<MoreOutlined />}>更多</Button>
      </Space>

      {/* Main content: left panel + right table */}
      <Layout style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, minHeight: 500 }}>
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
                      padding: '4px 8px',
                      cursor: 'pointer',
                      borderRadius: 4,
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
          <Button
            type="text"
            size="small"
            icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ position: 'absolute', top: '50%', right: -16, transform: 'translateY(-50%)', zIndex: 10 }}
          />
        </Sider>

        <Content style={{ padding: 12 }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={attachments}
            loading={loading}
            size="small"
            scroll={{ x: 900 }}
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
    </Space>
  )
}
