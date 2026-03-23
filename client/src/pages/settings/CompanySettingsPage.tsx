import { useState, useEffect } from 'react'
import { Card, Form, Input, Select, Button, Typography, message } from 'antd'
import { useAuthStore } from '@/stores/authStore'
import { api, type Company } from '@/api/client'
import ModuleTabBar from '@/components/layout/ModuleTabBar'

const SETTINGS_TABS = [
  { key: 'accounts', label: '科目设置', path: '/settings/accounts' },
  { key: 'periods', label: '期间管理', path: '/settings/periods' },
  { key: 'company', label: '账套管理', path: '/settings/company' },
  { key: 'users', label: '用户管理', path: '/settings/users' },
]

const { Title } = Typography

export default function CompanySettingsPage() {
  const { currentCompanyId, getCurrentRole } = useAuthStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const isAdmin = getCurrentRole() === 'admin'

  useEffect(() => {
    if (!currentCompanyId) return
    setLoading(true)
    api.getCompany(currentCompanyId).then(res => {
      const c = res.data.data
      form.setFieldsValue({
        name: c.name,
        taxNo: c.taxNo,
        legalPerson: c.legalPerson,
        industry: c.industry,
        address: c.address,
        phone: c.phone,
        accountingStandard: c.accountingStandard,
        currency: c.currency,
      })
    }).finally(() => setLoading(false))
  }, [currentCompanyId])

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await api.updateCompany(currentCompanyId!, {
        name: values.name,
        tax_no: values.taxNo,
        legal_person: values.legalPerson,
        industry: values.industry,
        address: values.address,
        phone: values.phone,
        accounting_standard: values.accountingStandard,
        currency: values.currency,
      } as unknown as Partial<Company>)
      message.success('账套信息已更新')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <ModuleTabBar tabs={SETTINGS_TABS} />
    <div style={{ maxWidth: 640, margin: '16px auto 0' }}>
      <Card loading={loading}>
        <Title level={4}>账套信息</Title>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="公司名称" rules={[{ required: true }]}>
            <Input disabled={!isAdmin} />
          </Form.Item>
          <Form.Item name="taxNo" label="统一社会信用代码">
            <Input disabled={!isAdmin} />
          </Form.Item>
          <Form.Item name="legalPerson" label="法人代表">
            <Input disabled={!isAdmin} />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Select disabled={!isAdmin} options={[
              { value: '制造业', label: '制造业' },
              { value: '服务业', label: '服务业' },
              { value: '商贸业', label: '商贸业' },
              { value: '建筑业', label: '建筑业' },
              { value: '信息技术', label: '信息技术' },
              { value: '其他', label: '其他' },
            ]} />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input disabled={!isAdmin} />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input disabled={!isAdmin} />
          </Form.Item>
          <Form.Item name="accountingStandard" label="会计准则">
            <Select disabled={!isAdmin} options={[
              { value: 'small', label: '小企业会计准则' },
              { value: 'general', label: '企业会计准则' },
            ]} />
          </Form.Item>
          <Form.Item name="currency" label="记账本位币">
            <Select disabled={!isAdmin} options={[
              { value: 'CNY', label: 'CNY - 人民币' },
              { value: 'USD', label: 'USD - 美元' },
            ]} />
          </Form.Item>
          {isAdmin && (
            <Form.Item>
              <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
            </Form.Item>
          )}
        </Form>
      </Card>
    </div>
    </>
  )
}
