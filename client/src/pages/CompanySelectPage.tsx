import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Typography, Input, Modal, Form, Row, Col, Spin, message, Empty, Dropdown } from 'antd'
import { PlusOutlined, BankOutlined, EditOutlined, DeleteOutlined, MoreOutlined, RightOutlined } from '@ant-design/icons'
import { api } from '@/api/client'
import { useCompanyStore, type Company } from '@/stores/companyStore'
import { useAuthStore } from '@/stores/authStore'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography

export default function CompanySelectPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { companies, setCompanies, setCurrentCompany } = useCompanyStore()
  const { setPeriods, setCurrentPeriod } = usePeriodStore()
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [form] = Form.useForm()

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const res = await api.listCompanies()
      setCompanies(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCompanies() }, [])

  const handleSelect = async (company: Company) => {
    setCurrentCompany(company)
    // Reset period state so it reloads for the new company
    setPeriods([])
    setCurrentPeriod(null as never)
    navigate('/dashboard')
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await api.createCompany({ name: values.name })
    message.success('账套创建成功')
    setShowCreate(false)
    form.resetFields()
    loadCompanies()
  }

  const handleEdit = async () => {
    if (!editingCompany) return
    const values = await form.validateFields()
    await api.updateCompany(editingCompany.id, { name: values.name })
    message.success('账套名称已更新')
    setEditingCompany(null)
    form.resetFields()
    loadCompanies()
  }

  const handleDelete = async (company: Company) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除账套"${company.name}"吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        await api.deleteCompany(company.id)
        message.success('账套已删除')
        loadCompanies()
      },
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '60px 24px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <BankOutlined style={{ fontSize: 48, color: '#fff', marginBottom: 16 }} />
        <Title level={2} style={{ color: '#fff', margin: 0 }}>乐算云会计</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>请选择或创建账套</Text>
      </div>

      <div style={{ width: '100%', maxWidth: 900 }}>
        <Spin spinning={loading}>
          {companies.length === 0 && !loading ? (
            <Card style={{ textAlign: 'center', padding: 40, borderRadius: 12 }}>
              <Empty description="暂无账套，请创建第一个账套" />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                style={{ marginTop: 24 }}
                onClick={() => { form.resetFields(); setShowCreate(true) }}
              >
                创建账套
              </Button>
            </Card>
          ) : (
            <Row gutter={[20, 20]}>
              {companies.map(company => (
                <Col xs={24} sm={12} md={8} key={company.id}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: 12,
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    styles={{ body: { padding: '24px 20px' } }}
                    onClick={() => handleSelect(company)}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 12,
                          background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginBottom: 16,
                        }}>
                          <BankOutlined style={{ fontSize: 24, color: '#fff' }} />
                        </div>
                        <Title level={5} style={{ margin: '0 0 8px 0' }} ellipsis>
                          {company.name}
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          创建于 {company.created_at?.slice(0, 10)}
                        </Text>
                      </div>
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: [
                            { key: 'edit', icon: <EditOutlined />, label: '编辑名称' },
                            { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
                          ],
                          onClick: ({ key, domEvent }) => {
                            domEvent.stopPropagation()
                            if (key === 'edit') {
                              form.setFieldsValue({ name: company.name })
                              setEditingCompany(company)
                            } else if (key === 'delete') {
                              handleDelete(company)
                            }
                          },
                        }}
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          size="small"
                          onClick={e => e.stopPropagation()}
                        />
                      </Dropdown>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>进入账套</Text>
                      <RightOutlined style={{ fontSize: 12, color: '#999', marginLeft: 4 }} />
                    </div>
                  </Card>
                </Col>
              ))}

              {/* Add new company card */}
              <Col xs={24} sm={12} md={8}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12,
                    height: '100%',
                    cursor: 'pointer',
                    borderStyle: 'dashed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 180,
                  }}
                  styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' } }}
                  onClick={() => { form.resetFields(); setShowCreate(true) }}
                >
                  <Space direction="vertical" align="center">
                    <PlusOutlined style={{ fontSize: 32, color: '#1677ff' }} />
                    <Text style={{ color: '#1677ff' }}>新建账套</Text>
                  </Space>
                </Card>
              </Col>
            </Row>
          )}
        </Spin>
      </div>

      {/* User info at bottom */}
      <div style={{ position: 'fixed', bottom: 24, right: 24 }}>
        <Space>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{user?.name}</Text>
          <Button type="link" style={{ color: 'rgba(255,255,255,0.8)' }} onClick={() => { logout(); navigate('/login') }}>
            退出登录
          </Button>
        </Space>
      </div>

      {/* Create Modal */}
      <Modal
        title="新建账套"
        open={showCreate}
        onOk={handleCreate}
        onCancel={() => { setShowCreate(false); form.resetFields() }}
        okText="创建"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="公司/账套名称" rules={[{ required: true, message: '请输入公司名称' }]}>
            <Input placeholder="例如：东莞博润环保科技有限公司" size="large" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑账套名称"
        open={!!editingCompany}
        onOk={handleEdit}
        onCancel={() => { setEditingCompany(null); form.resetFields() }}
        okText="保存"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="公司/账套名称" rules={[{ required: true, message: '请输入公司名称' }]}>
            <Input placeholder="请输入公司名称" size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
