import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, DatePicker, Button, Table, InputNumber, Select, Card, Space, Typography, message, Divider, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api, type Account } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography

interface LineItem {
  key: string
  accountCode?: string
  accountName?: string
  direction: 'debit' | 'credit'
  amount?: number
  remark?: string
}

export default function VoucherFormPage() {
  const navigate = useNavigate()
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [lines, setLines] = useState<LineItem[]>([
    { key: '1', direction: 'debit' },
    { key: '2', direction: 'credit' },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.leafAccounts().then(r => setAccounts(r.data.data))
    if (currentPeriod) {
      form.setFieldsValue({ voucherDate: dayjs(), periodId: currentPeriod.id })
    }
  }, [currentPeriod?.id])

  const totalDebit = lines.filter(l => l.direction === 'debit').reduce((s, l) => s + (l.amount ?? 0), 0)
  const totalCredit = lines.filter(l => l.direction === 'credit').reduce((s, l) => s + (l.amount ?? 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const updateLine = (key: string, field: string, value: unknown) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      if (field === 'accountCode') {
        const acc = accounts.find(a => a.code === value)
        return { ...l, accountCode: value as string, accountName: acc?.name }
      }
      return { ...l, [field]: value }
    }))
  }

  const addLine = () => setLines(prev => [...prev, { key: Date.now().toString(), direction: 'debit' }])
  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const handleSave = async (andSubmit = false) => {
    const values = await form.validateFields()
    const invalidLines = lines.filter(l => !l.accountCode || !l.amount)
    if (invalidLines.length > 0) { message.error('请填写所有凭证行的科目和金额'); return }
    if (!balanced) { message.error('借贷不平衡，请检查金额'); return }

    setSaving(true)
    try {
      const res = await api.createVoucher({
        voucherDate: values.voucherDate.format('YYYY-MM-DD'),
        periodId: currentPeriod!.id,
        summary: values.summary,
        lines: lines.map(l => ({
          accountCode: l.accountCode!,
          direction: l.direction,
          amount: l.amount!,
          remark: l.remark,
        })),
      })
      const voucher = res.data.data
      if (andSubmit) {
        await api.submitVoucher(voucher.id)
        message.success('凭证已保存并提交审核')
      } else {
        message.success('凭证已保存为草稿')
      }
      navigate('/vouchers')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<LineItem> = [
    {
      title: '借/贷', dataIndex: 'direction', width: 90,
      render: (v, r) => (
        <Select value={v} size="small" style={{ width: '100%' }}
          onChange={val => updateLine(r.key, 'direction', val)}
          options={[{ value: 'debit', label: <Text className="debit-col">借</Text> }, { value: 'credit', label: <Text className="credit-col">贷</Text> }]} />
      )
    },
    {
      title: '科目', dataIndex: 'accountCode', width: 260,
      render: (v, r) => (
        <Select
          showSearch value={v} size="small" style={{ width: '100%' }}
          placeholder="选择科目" optionFilterProp="label"
          onChange={val => updateLine(r.key, 'accountCode', val)}
          options={accounts.map(a => ({ value: a.code, label: `${a.code} ${a.name}` }))}
        />
      )
    },
    {
      title: '金额（元）', dataIndex: 'amount', width: 160,
      render: (v, r) => (
        <InputNumber
          value={v} size="small" style={{ width: '100%' }}
          min={0.01} precision={2} placeholder="0.00"
          onChange={val => updateLine(r.key, 'amount', val)}
        />
      )
    },
    {
      title: '备注', dataIndex: 'remark',
      render: (v, r) => (
        <Input value={v} size="small" placeholder="可选"
          onChange={e => updateLine(r.key, 'remark', e.target.value)} />
      )
    },
    {
      title: '', width: 40, fixed: 'right',
      render: (_, r) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => removeLine(r.key)} disabled={lines.length <= 2} />
      )
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>新增凭证</Title>
        <Space>
          <Button onClick={() => navigate('/vouchers')}>取消</Button>
          <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(false)}>保存草稿</Button>
          <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={() => handleSave(true)}>保存并提交</Button>
        </Space>
      </div>

      <Card size="small" title="基本信息">
        <Form form={form} layout="inline">
          <Form.Item label="凭证日期" name="voucherDate" rules={[{ required: true }]}>
            <DatePicker />
          </Form.Item>
          <Form.Item label="摘要" name="summary" rules={[{ required: true, message: '请填写摘要' }]} style={{ flex: 1, minWidth: 300 }}>
            <Input placeholder="请简要描述此次经济业务" />
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title="凭证明细"
        extra={<Button size="small" icon={<PlusOutlined />} onClick={addLine}>添加行</Button>}>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={lines}
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Space direction="vertical" size={0}>
                    <Text className="debit-col">借：¥{totalDebit.toFixed(2)}</Text>
                    <Text className="credit-col">贷：¥{totalCredit.toFixed(2)}</Text>
                  </Space>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} colSpan={2}>
                  {balanced
                    ? <Text type="success">✓ 借贷平衡</Text>
                    : <Text type="danger">✗ 差额：¥{Math.abs(totalDebit - totalCredit).toFixed(2)}</Text>}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {!balanced && totalDebit + totalCredit > 0 && (
        <Alert type="error" message={`借贷不平衡！借方合计 ¥${totalDebit.toFixed(2)}，贷方合计 ¥${totalCredit.toFixed(2)}，差额 ¥${Math.abs(totalDebit - totalCredit).toFixed(2)}`} />
      )}
      <Divider />
    </Space>
  )
}
