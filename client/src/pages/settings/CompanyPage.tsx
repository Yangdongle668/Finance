import { useEffect, useState } from 'react'
import {
  Table, Typography, Space, Button, Tag, Popconfirm,
  message, Modal, Form, Input, InputNumber, Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { api, type Company } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'

const { Title } = Typography

const STANDARD_LABELS: Record<string, string> = {
  small: '小企业会计准则',
  general: '企业会计准则（一般）',
}

export default function CompanyPage() {
  const getCurrentRole = useAuthStore(s => s.getCurrentRole)
  const isAdmin = getCurrentRole() === 'admin'

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const refresh = () => {
    setLoading(true)
    api.listCompanies().then(r => setCompanies(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const openAdd = () => {
    setEditingCompany(null)
    form.resetFields()
    form.setFieldsValue({
      fiscalYearStart: 1,
      accountingStandard: 'small',
      currency: 'CNY',
    })
    setModalOpen(true)
  }

  const openEdit = (c: Company) => {
    setEditingCompany(c)
    form.setFieldsValue({
      name: c.name,
      taxNo: c.taxNo,
      legalPerson: c.legalPerson,
      industry: c.industry,
      address: c.address,
      phone: c.phone,
      fiscalYearStart: c.fiscalYearStart,
      accountingStandard: c.accountingStandard,
      currency: c.currency,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      if (editingCompany) {
        await api.updateCompany(editingCompany.id, values)
        message.success('账套信息已更新')
      } else {
        await api.createCompany(values)
        message.success('账套创建成功')
      }
      setModalOpen(false)
      refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    await api.deleteCompany(id)
    message.success('账套已删除')
    refresh()
  }

  const columns = [
    {
      title: '企业名称',
      dataIndex: 'name',
      render: (v: string, r: Company) => (
        <Space>
          {v}
          {r.id === 'default' && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    { title: '税号', dataIndex: 'taxNo', render: (v: string | null) => v || '—' },
    { title: '法人代表', dataIndex: 'legalPerson', render: (v: string | null) => v || '—' },
    { title: '行业', dataIndex: 'industry', render: (v: string | null) => v || '—' },
    {
      title: '会计准则',
      dataIndex: 'accountingStandard',
      render: (v: string) => <Tag color={v === 'small' ? 'blue' : 'purple'}>{STANDARD_LABELS[v] || v}</Tag>,
    },
    { title: '记账本位币', dataIndex: 'currency', width: 110 },
    { title: '财年起始月', dataIndex: 'fiscalYearStart', width: 100, render: (v: number) => `${v} 月` },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, r: Company) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          {isAdmin && r.id !== 'default' && (
            <Popconfirm
              title="确认删除该账套？此操作不可恢复。"
              onConfirm={() => handleDelete(r.id)}
              okText="删除"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>账套管理</Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            新建账套
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={companies}
        loading={loading}
        size="small"
        pagination={false}
      />

      <Modal
        title={editingCompany ? '编辑账套' : '新建账套'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingCompany ? '保存' : '创建'}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }]}>
            <Input placeholder="例：示例企业有限公司" maxLength={100} />
          </Form.Item>

          <Form.Item name="taxNo" label="纳税人识别号">
            <Input placeholder="统一社会信用代码" maxLength={20} />
          </Form.Item>

          <Form.Item name="legalPerson" label="法人代表">
            <Input placeholder="法人代表姓名" maxLength={50} />
          </Form.Item>

          <Form.Item name="industry" label="所属行业">
            <Input placeholder="例：制造业、服务业、信息技术" maxLength={50} />
          </Form.Item>

          <Form.Item name="address" label="企业地址">
            <Input placeholder="注册地址" maxLength={200} />
          </Form.Item>

          <Form.Item name="phone" label="联系电话">
            <Input placeholder="联系电话" maxLength={30} />
          </Form.Item>

          <Form.Item name="accountingStandard" label="适用会计准则" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="small">小企业会计准则</Select.Option>
              <Select.Option value="general">企业会计准则（一般）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="fiscalYearStart" label="财年起始月" rules={[{ required: true }]}>
            <InputNumber min={1} max={12} style={{ width: '100%' }} addonAfter="月" />
          </Form.Item>

          <Form.Item name="currency" label="记账本位币" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="CNY">人民币（CNY）</Select.Option>
              <Select.Option value="USD">美元（USD）</Select.Option>
              <Select.Option value="EUR">欧元（EUR）</Select.Option>
              <Select.Option value="HKD">港元（HKD）</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
