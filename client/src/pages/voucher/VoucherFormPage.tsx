import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Select, DatePicker, InputNumber, Input, Space, Typography, message, Dropdown, Tooltip } from 'antd'
import {
  SaveOutlined, PlusOutlined, InboxOutlined, SettingOutlined,
  SmileOutlined, FullscreenOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, type Account, type VoucherWord } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import { useAuthStore } from '@/stores/authStore'

const { Text, Title } = Typography

const VOUCHER_WORDS: VoucherWord[] = ['记', '收', '付', '转']
const VOUCHER_WORD_TITLES: Record<VoucherWord, string> = {
  '记': '记 账 凭 证',
  '收': '收 款 凭 证',
  '付': '付 款 凭 证',
  '转': '转 账 凭 证',
}

interface LineItem {
  key: string
  summary: string
  accountCode: string
  accountName: string
  debitAmount: number | null
  creditAmount: number | null
}

const emptyLine = (): LineItem => ({
  key: Date.now().toString() + Math.random(),
  summary: '',
  accountCode: '',
  accountName: '',
  debitAmount: null,
  creditAmount: null,
})

export default function VoucherFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const currentPeriod = usePeriodStore(s => s.currentPeriod)
  const user = useAuthStore(s => s.user)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [voucherWord, setVoucherWord] = useState<VoucherWord>('记')
  const [voucherNo, setVoucherNo] = useState('')
  const [voucherDate, setVoucherDate] = useState(dayjs())
  const [attachmentCount, setAttachmentCount] = useState(0)
  const [lines, setLines] = useState<LineItem[]>([emptyLine(), emptyLine(), emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)

  // Load accounts
  useEffect(() => {
    api.leafAccounts().then(r => setAccounts(r.data.data))
  }, [])

  // Get next voucher number
  useEffect(() => {
    if (!currentPeriod || isEdit) return
    api.getNextVoucherNo(currentPeriod.id, voucherWord).then(r => {
      setVoucherNo(r.data.data.voucherNo)
    })
  }, [currentPeriod?.id, voucherWord, isEdit])

  // Load existing voucher for edit
  useEffect(() => {
    if (!id) return
    api.getVoucher(id).then(r => {
      const v = r.data.data
      setVoucherWord(v.voucherWord || '记')
      setVoucherNo(v.voucherNo)
      setVoucherDate(dayjs(v.voucherDate))
      setAttachmentCount(v.attachmentCount ?? 0)
      const loadedLines: LineItem[] = (v.lines ?? []).map(l => ({
        key: l.id,
        summary: l.remark || '',
        accountCode: l.accountCode,
        accountName: l.accountName,
        debitAmount: l.direction === 'debit' ? l.amount / 100 : null,
        creditAmount: l.direction === 'credit' ? l.amount / 100 : null,
      }))
      // Ensure at least 4 rows
      while (loadedLines.length < 4) loadedLines.push(emptyLine())
      setLines(loadedLines)
    })
  }, [id])

  const totalDebit = lines.reduce((s, l) => s + (l.debitAmount ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const updateLine = useCallback((key: string, field: keyof LineItem, value: unknown) => {
    setLines(prev => {
      const updated = prev.map(l => {
        if (l.key !== key) return l
        const newLine = { ...l, [field]: value }
        // Debit/credit mutually exclusive
        if (field === 'debitAmount' && value) newLine.creditAmount = null
        if (field === 'creditAmount' && value) newLine.debitAmount = null
        // Set account name when code selected
        if (field === 'accountCode') {
          const acc = accounts.find(a => a.code === value)
          newLine.accountName = acc?.name ?? ''
        }
        return newLine
      })
      // Auto-add row if last row has content
      const last = updated[updated.length - 1]
      if (last && (last.summary || last.accountCode || last.debitAmount || last.creditAmount)) {
        updated.push(emptyLine())
      }
      return updated
    })
  }, [accounts])

  const removeLine = (key: string) => {
    setLines(prev => {
      if (prev.length <= 2) return prev
      return prev.filter(l => l.key !== key)
    })
  }

  const buildPayload = () => {
    const validLines = lines.filter(l => l.accountCode && (l.debitAmount || l.creditAmount))
    if (validLines.length < 2) {
      message.error('至少需要2行有效分录')
      return null
    }
    if (!balanced) {
      message.error('借贷不平衡，请检查金额')
      return null
    }
    return {
      voucherDate: voucherDate.format('YYYY-MM-DD'),
      periodId: currentPeriod!.id,
      summary: validLines[0]?.summary || '凭证',
      voucherWord,
      attachmentCount,
      lines: validLines.map(l => ({
        accountCode: l.accountCode,
        direction: (l.debitAmount ? 'debit' : 'credit') as string,
        amount: l.debitAmount ?? l.creditAmount ?? 0,
        summary: l.summary,
        remark: l.summary,
      })),
    }
  }

  const handleSave = async (andNew = false) => {
    const payload = buildPayload()
    if (!payload) return
    setSaving(true)
    try {
      if (isEdit) {
        await api.updateVoucher(id!, payload)
        message.success('凭证更新成功')
      } else {
        await api.createVoucher(payload)
        message.success('凭证保存成功')
      }
      if (andNew) {
        // Reset form
        setLines([emptyLine(), emptyLine(), emptyLine(), emptyLine()])
        setAttachmentCount(0)
        setVoucherDate(dayjs())
        // Get new number
        if (currentPeriod) {
          const r = await api.getNextVoucherNo(currentPeriod.id, voucherWord)
          setVoucherNo(r.data.data.voucherNo)
        }
      } else {
        navigate('/vouchers')
      }
    } finally {
      setSaving(false)
    }
  }

  const periodLabel = currentPeriod ? `${currentPeriod.year}年第${currentPeriod.month}期` : ''
  const voucherNoNum = voucherNo.split('-')[1] || '1'

  return (
    <div style={{ background: '#fff', minHeight: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(true)}>
            保存并新增
          </Button>
          <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(false)}>
            保存
          </Button>
          <Dropdown menu={{ items: [{ key: 'draft', label: '暂存为草稿' }] }}>
            <Button><InboxOutlined /> 暂存</Button>
          </Dropdown>
          <Dropdown menu={{ items: [{ key: 'none', label: '暂无模板' }] }}>
            <Button>模板</Button>
          </Dropdown>
          <Button icon={<SettingOutlined />}>偏好设置</Button>
          <Button icon={<SmileOutlined />} type="text" />
        </Space>
        <Space>
          <Tooltip title="快捷键"><Text type="secondary" style={{ cursor: 'pointer', fontSize: 13 }}>快捷键</Text></Tooltip>
          <Tooltip title="大屏模式"><Button type="text" size="small" icon={<FullscreenOutlined />} /></Tooltip>
        </Space>
      </div>

      {/* Voucher Header */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space size={16}>
            <Space size={4}>
              <Text>凭证字:</Text>
              <Select
                value={voucherWord}
                onChange={setVoucherWord}
                style={{ width: 70 }}
                size="small"
                options={VOUCHER_WORDS.map(w => ({ value: w, label: w }))}
              />
            </Space>
            <Space size={4}>
              <InputNumber
                value={Number(voucherNoNum)}
                size="small"
                style={{ width: 70 }}
                min={1}
                readOnly={!isEdit}
              />
              <Text>号</Text>
            </Space>
            <Space size={4}>
              <Text>日期:</Text>
              <DatePicker
                value={voucherDate}
                onChange={d => d && setVoucherDate(d)}
                size="small"
                allowClear={false}
                format="YYYY/MM/DD"
              />
            </Space>
          </Space>
        </div>

        {/* Title area */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Title level={4} style={{ margin: 0, letterSpacing: 8 }}>
            {VOUCHER_WORD_TITLES[voucherWord]}
          </Title>
          <Text type="secondary">{periodLabel}</Text>
        </div>

        <div style={{ textAlign: 'right', marginBottom: 8 }}>
          <Space size={4}>
            <Text type="secondary">附件</Text>
            <InputNumber
              value={attachmentCount}
              onChange={v => setAttachmentCount(v ?? 0)}
              size="small"
              min={0}
              style={{ width: 50 }}
            />
            <Text type="secondary">张</Text>
          </Space>
        </div>
      </div>

      {/* Entry Table */}
      <div style={{ padding: '0 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d9d9d9' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={thStyle({ width: 50 })}>序号</th>
              <th style={thStyle({ width: 200 })}>摘要</th>
              <th style={thStyle({ minWidth: 220 })}>科目</th>
              <th style={thStyle({ width: 160 })}>借方金额</th>
              <th style={thStyle({ width: 160 })}>贷方金额</th>
              <th style={thStyle({ width: 40 })}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle({ textAlign: 'center', color: '#999' })}>{idx + 1}</td>
                <td style={tdStyle()}>
                  <Input
                    value={line.summary}
                    onChange={e => updateLine(line.key, 'summary', e.target.value)}
                    variant="borderless"
                    placeholder="摘要"
                    style={{ width: '100%' }}
                  />
                </td>
                <td style={tdStyle()}>
                  <Select
                    showSearch
                    value={line.accountCode || undefined}
                    onChange={val => updateLine(line.key, 'accountCode', val)}
                    style={{ width: '100%' }}
                    variant="borderless"
                    placeholder="输入科目编码或名称"
                    optionFilterProp="label"
                    options={accounts.map(a => ({ value: a.code, label: `${a.code} ${a.name}` }))}
                  />
                </td>
                <td style={tdStyle({ background: '#fffbe6' })}>
                  <InputNumber
                    value={line.debitAmount}
                    onChange={val => updateLine(line.key, 'debitAmount', val)}
                    style={{ width: '100%' }}
                    variant="borderless"
                    min={0}
                    precision={2}
                    placeholder=""
                    controls={false}
                  />
                </td>
                <td style={tdStyle({ background: '#f0f5ff' })}>
                  <InputNumber
                    value={line.creditAmount}
                    onChange={val => updateLine(line.key, 'creditAmount', val)}
                    style={{ width: '100%' }}
                    variant="borderless"
                    min={0}
                    precision={2}
                    placeholder=""
                    controls={false}
                  />
                </td>
                <td style={tdStyle({ textAlign: 'center' })}>
                  {lines.length > 2 && (
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeLine(line.key)}
                    />
                  )}
                </td>
              </tr>
            ))}
            {/* Summary row */}
            <tr style={{ background: '#f6ffed', fontWeight: 600, borderTop: '2px solid #52c41a' }}>
              <td style={tdStyle({ textAlign: 'center' })}></td>
              <td style={tdStyle()}>合计</td>
              <td style={tdStyle()}>
                {balanced
                  ? <Text type="success" style={{ fontSize: 12 }}>借贷平衡</Text>
                  : <Text type="danger" style={{ fontSize: 12 }}>差额: ¥{Math.abs(totalDebit - totalCredit).toFixed(2)}</Text>
                }
              </td>
              <td style={tdStyle({ textAlign: 'right', color: '#d4380d', background: '#fffbe6' })}>
                {totalDebit > 0 ? `¥${totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : ''}
              </td>
              <td style={tdStyle({ textAlign: 'right', color: '#389e0d', background: '#f0f5ff' })}>
                {totalCredit > 0 ? `¥${totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : ''}
              </td>
              <td style={tdStyle()}></td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 4, textAlign: 'right' }}>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setLines(prev => [...prev, emptyLine()])}>
            添加行
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', marginTop: 16 }}>
        <Space>
          <Text type="secondary">制单人:</Text>
          <Text strong>{user?.name || '—'}</Text>
        </Space>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(true)}>
            保存并新增
          </Button>
          <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(false)}>
            保存
          </Button>
        </Space>
      </div>
    </div>
  )
}

// Style helpers
function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '8px 12px',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 500,
    borderBottom: '1px solid #d9d9d9',
    borderRight: '1px solid #d9d9d9',
    ...extra,
  }
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '2px 4px',
    borderRight: '1px solid #f0f0f0',
    borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'middle',
    ...extra,
  }
}
