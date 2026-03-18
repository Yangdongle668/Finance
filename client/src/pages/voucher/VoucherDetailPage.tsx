import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Tag, Button, Space, Typography, Steps, message, Popconfirm, Divider } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, RetweetOutlined } from '@ant-design/icons'
import { api, type Voucher, type VoucherLine } from '@/api/client'

const { Title, Text } = Typography

const STATUS_STEPS: Record<string, number> = { draft: 0, pending: 1, approved: 2, posted: 3, reversed: 4 }
const STATUS_LABELS: Record<string, string> = { draft: '草稿', pending: '待审核', approved: '已审核', posted: '已记账', reversed: '已冲销' }

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [voucher, setVoucher] = useState<Voucher | null>(null)

  const fetch = async () => {
    const res = await api.getVoucher(id!)
    setVoucher(res.data.data)
  }

  useEffect(() => { fetch() }, [id])

  if (!voucher) return null

  const totalDebit = (voucher.lines ?? []).filter(l => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
  const totalCredit = (voucher.lines ?? []).filter(l => l.direction === 'credit').reduce((s, l) => s + l.amount, 0)

  const lineColumns = [
    { title: '行号', dataIndex: 'lineNo' as keyof VoucherLine, width: 60 },
    {
      title: '方向', dataIndex: 'direction' as keyof VoucherLine, width: 60,
      render: (v: string) => v === 'debit' ? <Text className="debit-col">借</Text> : <Text className="credit-col">贷</Text>
    },
    { title: '科目', render: (_: unknown, r: VoucherLine) => `${r.accountCode} ${r.accountName}` },
    { title: '金额（元）', dataIndex: 'amount' as keyof VoucherLine, align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '备注', dataIndex: 'remark' as keyof VoucherLine },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <Title level={4} style={{ margin: 0 }}>{voucher.voucherNo}</Title>
          <Tag color={voucher.status === 'posted' ? 'success' : voucher.status === 'reversed' ? 'error' : 'processing'}>
            {STATUS_LABELS[voucher.status]}
          </Tag>
        </Space>
        <Space>
          {voucher.status === 'pending' && <>
            <Popconfirm title="确认驳回此凭证？" onConfirm={async () => { await api.rejectVoucher(id!); message.success('已驳回'); fetch() }}>
              <Button danger icon={<CloseOutlined />}>驳回</Button>
            </Popconfirm>
            <Button type="primary" icon={<CheckOutlined />} onClick={async () => { await api.approveVoucher(id!); message.success('审核通过'); fetch() }}>审核通过</Button>
          </>}
          {voucher.status === 'approved' && (
            <Button type="primary" onClick={async () => { await api.postVoucher(id!); message.success('记账成功'); fetch() }}>记账</Button>
          )}
          {voucher.status === 'posted' && (
            <Popconfirm title="确认红字冲销此凭证？该操作不可逆。" onConfirm={async () => { await api.reverseVoucher(id!); message.success('冲销成功'); fetch() }}>
              <Button danger icon={<RetweetOutlined />}>红字冲销</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* 流程状态 */}
      <Card size="small">
        <Steps
          size="small"
          current={STATUS_STEPS[voucher.status]}
          items={[
            { title: '录入草稿' }, { title: '提交审核' }, { title: '审核批准' },
            { title: '记账入账' }, { title: '已冲销' },
          ]}
        />
      </Card>

      {/* 凭证基本信息 */}
      <Card size="small" title="凭证信息">
        <Descriptions size="small" column={3}>
          <Descriptions.Item label="凭证字号">{voucher.voucherNo}</Descriptions.Item>
          <Descriptions.Item label="凭证日期">{voucher.voucherDate}</Descriptions.Item>
          <Descriptions.Item label="类型">{voucher.type}</Descriptions.Item>
          <Descriptions.Item label="摘要" span={3}>{voucher.summary}</Descriptions.Item>
          <Descriptions.Item label="制单时间">{voucher.createdAt?.slice(0, 19)}</Descriptions.Item>
          <Descriptions.Item label="附件数量">{voucher.attachmentCount ?? 0} 份</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 凭证行 */}
      <Card size="small" title="凭证明细">
        <Table
          rowKey="id"
          columns={lineColumns}
          dataSource={voucher.lines ?? []}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><Text strong>合计</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Space direction="vertical" size={0}>
                    <Text className="debit-col">借：{totalDebit.toFixed(2)}</Text>
                    <Text className="credit-col">贷：{totalCredit.toFixed(2)}</Text>
                  </Space>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  {Math.abs(totalDebit - totalCredit) < 0.01
                    ? <Text type="success">平衡</Text>
                    : <Text type="danger">不平衡！</Text>}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
      <Divider />
    </Space>
  )
}
