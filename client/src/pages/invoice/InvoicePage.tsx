import { useEffect, useState } from 'react'
import { Table, Card, Button, Space, Tag, Typography, Modal, Form, Input, InputNumber, Select, DatePicker, Tabs, Statistic, Row, Col, Upload, message } from 'antd'
import { PlusOutlined, UploadOutlined, FileImageOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, type Invoice, type InvoiceStats } from '@/api/client'

const { Title } = Typography

const STATUS_COLORS: Record<string, string> = {
  pending: 'default', certified: 'blue', deducted: 'green', voided: 'red'
}
const STATUS_LABELS: Record<string, string> = {
  pending: '待认证', certified: '已认证', deducted: '已抵扣', voided: '已作废'
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp']

export default function InvoicePage() {
  const [direction, setDirection] = useState<'input' | 'output'>('input')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [uploading, setUploading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const [inv, st] = await Promise.all([
      api.listInvoices({ direction, page, pageSize: 20 }),
      api.invoiceStats(),
    ])
    setInvoices(inv.data.data)
    setTotal(inv.data.total)
    setStats(st.data.data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [direction, page])

  const handleCreate = async () => {
    const values = await form.validateFields()
    const taxAmount = values.amountExTax * values.taxRate
    await api.createInvoice({ ...values, invoiceDate: values.invoiceDate.format('YYYY-MM-DD'), taxAmount, totalAmount: values.amountExTax + taxAmount, direction })
    message.success('发票录入成功')
    setShowForm(false)
    form.resetFields()
    refresh()
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const isImage = IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|bmp|webp)$/i.test(file.name)
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

      let res
      if (isPdf) {
        res = await api.parseInvoicePdf(file)
      } else if (isImage) {
        message.loading({ content: '正在OCR识别图片，请稍候...', key: 'ocr', duration: 0 })
        res = await api.parseInvoiceImage(file)
        message.destroy('ocr')
      } else {
        message.warning('不支持的文件格式')
        return false
      }

      const parsed = res.data.data
      form.resetFields()
      form.setFieldsValue({
        invoiceType: parsed.invoiceType || 'vat_general',
        invoiceNo: parsed.invoiceNo || '',
        invoiceCode: parsed.invoiceCode || '',
        invoiceDate: parsed.invoiceDate ? dayjs(parsed.invoiceDate) : dayjs(),
        sellerName: parsed.sellerName || '',
        amountExTax: parsed.amountExTax || undefined,
        taxRate: parsed.taxRate || 0.13,
        remark: parsed.rawText ? `[${isPdf ? 'PDF' : '图片'}解析] ${parsed.rawText.substring(0, 200)}` : '',
      })
      setShowForm(true)

      if (parsed.ocrFailed) {
        message.warning('图片OCR识别效果不佳，请手动填写发票信息')
      } else {
        message.success(`${isPdf ? 'PDF' : '图片'}解析完成，请核对信息后提交`)
      }
    } catch {
      message.warning('文件解析失败，请手动录入')
      form.resetFields()
      setShowForm(true)
    } finally {
      setUploading(false)
    }
    return false
  }

  const inputStats = stats.find(s => s.direction === 'input')
  const outputStats = stats.find(s => s.direction === 'output')

  const columns = [
    { title: '发票号码', dataIndex: 'invoiceNo', width: 160 },
    { title: '发票日期', dataIndex: 'invoiceDate', width: 110 },
    { title: direction === 'input' ? '销方名称' : '购方名称', dataIndex: direction === 'input' ? 'sellerName' : 'buyerName', ellipsis: true },
    { title: '不含税金额', dataIndex: 'amountExTax', align: 'right' as const, render: (v: number) => (v / 100).toFixed(2) },
    { title: '税额', dataIndex: 'taxAmount', align: 'right' as const, render: (v: number) => (v / 100).toFixed(2) },
    { title: '价税合计', dataIndex: 'totalAmount', align: 'right' as const, render: (v: number) => <strong>{(v / 100).toFixed(2)}</strong> },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag> },
    {
      title: '操作', width: 80,
      render: (_: unknown, r: Invoice) => r.status === 'pending'
        ? <Button size="small" type="link" onClick={async () => { await api.certifyInvoice(r.id); refresh() }}>认证</Button>
        : null
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>发票管理</Title>
        <Space>
          <Upload
            accept=".pdf,.jpg,.jpeg,.png,.bmp,.webp"
            showUploadList={false}
            beforeUpload={handleFileUpload}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              导入发票（PDF/图片）
            </Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setShowForm(true) }}>手动录入</Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}><Card size="small"><Statistic title="进项发票合计（含税）" value={((inputStats?.total_amount ?? 0) / 100).toFixed(2)} prefix="¥" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进项税额" value={((inputStats?.total_tax ?? 0) / 100).toFixed(2)} prefix="¥" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="销项发票合计（含税）" value={((outputStats?.total_amount ?? 0) / 100).toFixed(2)} prefix="¥" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="销项税额" value={((outputStats?.total_tax ?? 0) / 100).toFixed(2)} prefix="¥" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>

      <Tabs activeKey={direction} onChange={k => { setDirection(k as 'input' | 'output'); setPage(1) }}
        items={[{ key: 'input', label: '进项发票' }, { key: 'output', label: '销项发票' }]} />

      <Table rowKey="id" columns={columns} dataSource={invoices} loading={loading} size="small"
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }} />

      <Modal title="录入发票" open={showForm} onOk={handleCreate}
        onCancel={() => { setShowForm(false); form.resetFields() }} width={600}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="invoiceType" label="发票类型" rules={[{ required: true }]}>
                <Select options={[{ value: 'vat_special', label: '增值税专用发票' }, { value: 'vat_general', label: '增值税普通发票' }, { value: 'receipt', label: '收据' }, { value: 'other', label: '其他' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoiceDate" label="发票日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="invoiceNo" label="发票号码" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoiceCode" label="发票代码">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="sellerName" label={direction === 'input' ? '销方名称' : '购方名称'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="amountExTax" label="不含税金额（元）" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="taxRate" label="税率" rules={[{ required: true }]} initialValue={0.13}>
                <Select options={[{ value: 0.13, label: '13%' }, { value: 0.09, label: '9%' }, { value: 0.06, label: '6%' }, { value: 0.03, label: '3%' }, { value: 0, label: '0%' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
