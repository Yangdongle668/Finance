import { useEffect, useState } from 'react'
import { Table, Card, Button, Space, Tag, Typography, Modal, Form, Input, InputNumber, Select, DatePicker, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, type Asset } from '@/api/client'

const { Title } = Typography

const DEPR_LABELS: Record<string, string> = {
  straight_line: '年限平均法',
  workload: '工作量法',
  accelerated: '加速折旧法',
}

export default function AssetPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form] = Form.useForm()

  const refresh = () => {
    setLoading(true)
    api.listAssets().then(r => setAssets(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await api.createAsset({
      ...values,
      acquiredDate: values.acquiredDate.format('YYYY-MM-DD'),
      startDeprecDate: values.startDeprecDate.format('YYYY-MM-DD'),
    })
    message.success('资产登记成功')
    setShowForm(false)
    form.resetFields()
    refresh()
  }

  const columns = [
    { title: '资产编号', dataIndex: 'assetNo', width: 120 },
    { title: '资产名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '原值（元）', dataIndex: 'originalValue', align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '使用年限', dataIndex: 'usefulLife', width: 100, render: (v: number) => `${v} 月` },
    { title: '取得日期', dataIndex: 'acquiredDate', width: 120 },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '使用中' : '已处置'}</Tag> },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>固定资产管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>登记资产</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={assets} loading={loading} size="small"
        pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }} />

      <Modal title="新增固定资产" open={showForm} onOk={handleCreate}
        onCancel={() => { setShowForm(false); form.resetFields() }} width={640}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="assetNo" label="资产编号" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="FA-001" />
            </Form.Item>
            <Form.Item name="name" label="资产名称" rules={[{ required: true }]} style={{ flex: 2, marginLeft: 8 }}>
              <Input placeholder="笔记本电脑" />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="category" label="资产分类" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="办公设备" />
            </Form.Item>
            <Form.Item name="originalValue" label="原值（元）" rules={[{ required: true }]} style={{ flex: 1, marginLeft: 8 }}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="usefulLife" label="使用年限（月）" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="salvageRate" label="残值率" initialValue={0.05} style={{ flex: 1, marginLeft: 8 }}>
              <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="acquiredDate" label="取得日期" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
            </Form.Item>
            <Form.Item name="startDeprecDate" label="开始折旧日期" rules={[{ required: true }]} style={{ flex: 1, marginLeft: 8 }}>
              <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="depreciationMethod" label="折旧方法" initialValue="straight_line">
            <Select options={Object.entries(DEPR_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="accountCode" label="资产科目" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="1601" />
            </Form.Item>
            <Form.Item name="deprAccountCode" label="累计折旧科目" rules={[{ required: true }]} style={{ flex: 1, marginLeft: 8 }}>
              <Input placeholder="1602" />
            </Form.Item>
            <Form.Item name="expenseAccountCode" label="折旧费用科目" rules={[{ required: true }]} style={{ flex: 1, marginLeft: 8 }}>
              <Input placeholder="660202" />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>
    </Space>
  )
}
