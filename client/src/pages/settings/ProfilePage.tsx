import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Divider, Typography, message, Space } from 'antd'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/api/client'

const { Title } = Typography

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [profileForm] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ name: user.name, email: user.email, phone: user.phone })
    }
  }, [user])

  const handleSaveProfile = async () => {
    const values = await profileForm.validateFields()
    setSaving(true)
    try {
      const res = await api.updateProfile(values)
      updateUser(res.data.data)
      message.success('个人信息更新成功')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    const values = await pwdForm.validateFields()
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    setChangingPwd(true)
    try {
      await api.changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword })
      message.success('密码修改成功')
      pwdForm.resetFields()
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card>
        <Title level={4}>个人信息</Title>
        <Form form={profileForm} layout="vertical">
          <Form.Item label="用户名">
            <Input value={user?.username} disabled />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleSaveProfile} loading={saving}>保存</Button>
          </Form.Item>
        </Form>

        <Divider />

        <Title level={4}>修改密码</Title>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true, message: '请确认新密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleChangePassword} loading={changingPwd}>修改密码</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
