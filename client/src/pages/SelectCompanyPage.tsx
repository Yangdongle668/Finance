import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Typography, Space, Button, List, Tag, Modal, Form, Input, Select, message } from 'antd'
import { BankOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/api/client'

const { Title, Text } = Typography

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  supervisor: '主管',
  accountant: '会计',
  cashier: '出纳',
  viewer: '查看者',
}

export default function SelectCompanyPage() {
  const navigate = useNavigate()
  const { companies, setCurrentCompany, setCompanies, logout, user } = useAuthStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

  const handleSelect = (companyId: string) => {
    setCurrentCompany(companyId)
    navigate('/')
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    setCreating(true)
    try {
      const res = await api.createCompany(values)
      const newId = res.data.data.id
      // Refresh companies list
      const meRes = await api.me()
      setCompanies(meRes.data.data.companies)
      setCurrentCompany(newId)
      message.success('账套创建成功')
      setCreateOpen(false)
      navigate('/')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 560, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} styles={{ body: { padding: '32px 40px' } }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <BankOutlined style={{ fontSize: 28, color: '#1677ff' }} />
              <Title level={4} style={{ margin: 0 }}>选择账套</Title>
            </Space>
            <Space>
              <Text type="secondary">{user?.name}</Text>
              <Button type="link" size="small" onClick={handleLogout}>退出</Button>
            </Space>
          </div>

          {companies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text type="secondary">暂无可用账套，请创建一个新的账套</Text>
            </div>
          ) : (
            <List
              dataSource={companies}
              renderItem={item => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '12px 16px', borderRadius: 8, marginBottom: 8, border: '1px solid #f0f0f0', transition: 'all 0.2s' }}
                  onClick={() => handleSelect(item.id)}
                  extra={<RightOutlined style={{ color: '#bbb' }} />}
                >
                  <List.Item.Meta
                    avatar={<BankOutlined style={{ fontSize: 20, color: '#1677ff', marginTop: 4 }} />}
                    title={<Text strong>{item.name}</Text>}
                    description={<Tag color="blue">{ROLE_LABELS[item.role] || item.role}</Tag>}
                  />
                </List.Item>
              )}
            />
          )}

          <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setCreateOpen(true)}>
            新建账套
          </Button>
        </Space>
      </Card>

      <Modal
        title="新建账套"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
            <Input placeholder="请输入公司全称" />
          </Form.Item>
          <Form.Item name="tax_no" label="税号">
            <Input placeholder="统一社会信用代码" />
          </Form.Item>
          <Form.Item name="legal_person" label="法人代表">
            <Input />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Select placeholder="选择行业" allowClear options={[
              { value: '制造业', label: '制造业' },
              { value: '服务业', label: '服务业' },
              { value: '商贸业', label: '商贸业' },
              { value: '建筑业', label: '建筑业' },
              { value: '信息技术', label: '信息技术' },
              { value: '其他', label: '其他' },
            ]} />
          </Form.Item>
          <Form.Item name="accounting_standard" label="会计准则" initialValue="small">
            <Select options={[
              { value: 'small', label: '小企业会计准则' },
              { value: 'general', label: '企业会计准则' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
