import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Space, message } from 'antd'
import { BankOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res = await api.login(values)
      const { token, user, companies } = res.data.data
      setAuth(token, user, companies)
      message.success(`欢迎回来，${user.name}`)
      navigate('/select-company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} styles={{ body: { padding: '40px 40px 32px' } }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <BankOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 12 }} />
            <Title level={3} style={{ margin: 0 }}>乐算云系统</Title>
            <Text type="secondary">专为个人/小微企业设计的云端财务管理系统</Text>
          </div>

          <Form onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
            乐算云 - 智能财务管理
          </Text>
        </Space>
      </Card>
    </div>
  )
}
