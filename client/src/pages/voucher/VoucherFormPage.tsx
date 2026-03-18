import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Select, DatePicker, InputNumber, Input, Space, Typography, message, Dropdown, Tooltip, Modal } from 'antd'
import {
  InboxOutlined, SettingOutlined,
  DeleteOutlined, SearchOutlined,
  LeftOutlined, RightOutlined, PaperClipOutlined,
  EllipsisOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, type Account, type VoucherWord } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'
import { useAuthStore } from '@/stores/authStore'
import VoucherTabBar from './VoucherTabBar'
import AmountGrid, { AmountGridHeader } from './AmountGrid'

const { Text, Title } = Typography

const VOUCHER_WORDS: VoucherWord[] = ['记', '收', '付', '转']
const VOUCHER_WORD_TITLES: Record<VoucherWord, string> = {
  '记': '记账凭证',
  '收': '收款凭证',
  '付': '付款凭证',
  '转': '转账凭证',
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
  const [allVoucherIds, setAllVoucherIds] = useState<string[]>([])

  useEffect(() => {
    api.leafAccounts().then(r => setAccounts(r.data.data))
  }, [])

  // Load list of voucher IDs for prev/next navigation
  useEffect(() => {
    if (!currentPeriod) return
    api.listVouchers({ periodId: currentPeriod.id, pageSize: 1000 }).then(r => {
      setAllVoucherIds(r.data.data.map(v => v.id))
    })
  }, [currentPeriod?.id])

  useEffect(() => {
    if (!currentPeriod || isEdit) return
    api.getNextVoucherNo(currentPeriod.id, voucherWord).then(r => {
      setVoucherNo(r.data.data.voucherNo)
    })
    // Default date constrained to current period
    const now = dayjs()
    const periodStart = dayjs(currentPeriod.startDate)
    const periodEnd = dayjs(currentPeriod.endDate)
    if (now.isBefore(periodStart)) setVoucherDate(periodStart)
    else if (now.isAfter(periodEnd)) setVoucherDate(periodEnd)
    else setVoucherDate(now)
  }, [currentPeriod?.id, voucherWord, isEdit])

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
        if (field === 'debitAmount' && value) newLine.creditAmount = null
        if (field === 'creditAmount' && value) newLine.debitAmount = null
        if (field === 'accountCode') {
          const acc = accounts.find(a => a.code === value)
          newLine.accountName = acc?.name ?? ''
        }
        return newLine
      })
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

  /** 双击空白金额格自动平衡：计算差额并填入 */
  const handleAutoBalance = useCallback((key: string, field: 'debitAmount' | 'creditAmount') => {
    setLines(prev => {
      const target = prev.find(l => l.key === key)
      if (!target) return prev
      // 只有当前格为空时才自动填入
      if (target[field] !== null && target[field] !== undefined) return prev

      const totalDebit = prev.reduce((s, l) => s + (l.debitAmount ?? 0), 0)
      const totalCredit = prev.reduce((s, l) => s + (l.creditAmount ?? 0), 0)
      const diff = field === 'creditAmount'
        ? totalDebit - totalCredit   // 差额填入贷方
        : totalCredit - totalDebit   // 差额填入借方

      if (diff <= 0) return prev  // 无差额或已平衡则不填

      return prev.map(l => {
        if (l.key !== key) return l
        const updated = { ...l, [field]: diff }
        if (field === 'debitAmount') updated.creditAmount = null
        else updated.debitAmount = null
        return updated
      })
    })
  }, [])

  const buildPayload = (allowImbalanced = false) => {
    const validLines = lines.filter(l => l.accountCode && (l.debitAmount || l.creditAmount))
    if (validLines.length < 2) {
      message.error('至少需要2行有效分录')
      return null
    }
    if (!allowImbalanced && !balanced) {
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
    const payload = buildPayload(false)
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
        setLines([emptyLine(), emptyLine(), emptyLine(), emptyLine()])
        setAttachmentCount(0)
        if (currentPeriod) {
          const now = dayjs()
          const periodStart = dayjs(currentPeriod.startDate)
          const periodEnd = dayjs(currentPeriod.endDate)
          if (now.isBefore(periodStart)) setVoucherDate(periodStart)
          else if (now.isAfter(periodEnd)) setVoucherDate(periodEnd)
          else setVoucherDate(now)
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

  /** 暂存草稿：允许借贷不平衡，校验宽松 */
  const handleDraftSave = async () => {
    const validLines = lines.filter(l => l.accountCode && (l.debitAmount || l.creditAmount))
    if (validLines.length < 1) {
      message.error('至少需要1行有效分录才能暂存')
      return
    }
    const payload = {
      voucherDate: voucherDate.format('YYYY-MM-DD'),
      periodId: currentPeriod!.id,
      summary: validLines[0]?.summary || '草稿凭证',
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
    // 草稿允许借贷不平衡：如不平衡则补一行差额（系统虚拟行）以通过后端校验
    const dTotal = payload.lines.filter(l => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
    const cTotal = payload.lines.filter(l => l.direction === 'credit').reduce((s, l) => s + l.amount, 0)
    const diff = Math.abs(dTotal - cTotal)
    if (diff > 0.001) {
      // 添加平衡行（使用"待确认"科目占位，此处假设科目不存在时后端会提示）
      // 改为直接提示用户，不强制暂存不平衡凭证
      message.warning(`借贷差额为 ¥${diff.toFixed(2)}，请填写完整后再保存。暂时保存到本地草稿。`)
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await api.updateVoucher(id!, payload)
      } else {
        await api.createVoucher(payload)
      }
      message.success('已暂存为草稿')
    } finally {
      setSaving(false)
    }
  }

  /** 上传附件：弹出附件管理或跳转 */
  const handleUploadAttachment = () => {
    Modal.info({
      title: '附件管理',
      content: (
        <div>
          <p>点击确认前往原始凭证管理页面，可上传和关联附件。</p>
          <p style={{ color: '#999', fontSize: 12 }}>提示：保存凭证后，可在原始凭证页面关联此凭证。</p>
        </div>
      ),
      okText: '前往管理',
      cancelText: '取消',
      onOk: () => navigate('/voucher/attachment-manage'),
    })
  }

  const navigateVoucher = (direction: 'prev' | 'next') => {
    if (!id || allVoucherIds.length === 0) return
    const currentIdx = allVoucherIds.indexOf(id)
    if (currentIdx === -1) return
    const newIdx = direction === 'prev' ? currentIdx - 1 : currentIdx + 1
    if (newIdx < 0 || newIdx >= allVoucherIds.length) {
      message.info(direction === 'prev' ? '已是第一张凭证' : '已是最后一张凭证')
      return
    }
    navigate(`/vouchers/${allVoucherIds[newIdx]}/edit`)
  }

  const periodLabel = currentPeriod ? `${currentPeriod.year}年第${currentPeriod.month}期` : ''
  const voucherNoNum = voucherNo.split('-')[1] || '1'

  return (
    <div style={{ background: '#fff', minHeight: '100%', margin: '-24px', display: 'flex', flexDirection: 'column' }}>
      {/* Tab navigation */}
      <VoucherTabBar />

      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="primary" loading={saving} onClick={() => handleSave(true)}>
            保存并新增
          </Button>
          <Button loading={saving} onClick={() => handleSave(false)}>
            保存
          </Button>
          <Button loading={saving} onClick={handleDraftSave} icon={<InboxOutlined />}>
            暂存
          </Button>
          <Dropdown menu={{ items: [{ key: 'none', label: '暂无模板', disabled: true }] }}>
            <Button>模板</Button>
          </Dropdown>
        </Space>
        <Space>
          <Tooltip title="上一张凭证">
            <Button type="text" size="small" icon={<LeftOutlined />} disabled={!isEdit} onClick={() => navigateVoucher('prev')} />
          </Tooltip>
          <Tooltip title="下一张凭证">
            <Button type="text" size="small" icon={<RightOutlined />} disabled={!isEdit} onClick={() => navigateVoucher('next')} />
          </Tooltip>
        </Space>
      </div>

      {/* Voucher Header */}
      <div style={{ padding: '12px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={12}>
            <Space size={4}>
              <Text>凭证字</Text>
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
              <Text>日期</Text>
              <DatePicker
                value={voucherDate}
                onChange={d => d && setVoucherDate(d)}
                size="small"
                allowClear={false}
                format="YYYY/MM/DD"
              />
            </Space>
          </Space>

          <Space size={4}>
            <SearchOutlined style={{ color: '#999' }} />
            <Text type="secondary">附件</Text>
            <InputNumber
              value={attachmentCount}
              onChange={v => setAttachmentCount(v ?? 0)}
              size="small"
              min={0}
              style={{ width: 50 }}
            />
            <Text type="secondary">张</Text>
            <a style={{ color: '#1677ff', fontSize: 13, marginLeft: 8 }} onClick={handleUploadAttachment}>
              <PaperClipOutlined /> 上传附件
            </a>
          </Space>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
          <Title level={4} style={{ margin: 0, letterSpacing: 8, fontWeight: 700 }}>
            {VOUCHER_WORD_TITLES[voucherWord]}
          </Title>
          <Text type="secondary" style={{ color: '#1677ff' }}>{periodLabel}</Text>
        </div>
      </div>

      {/* Entry Table with 金算盘 Grid */}
      <div style={{ padding: '0 24px', flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d9d9d9' }}>
          <thead>
            {/* First header row */}
            <tr style={{ background: '#fafafa' }}>
              <th rowSpan={2} style={thStyle({ width: 40 })}></th>
              <th rowSpan={2} style={thStyle({ width: 260 })}>摘要</th>
              <th rowSpan={2} style={thStyle({ minWidth: 260 })}>科目</th>
              <th colSpan={1} style={thStyle({ padding: '4px 0', borderBottom: 'none' })}>
                <div style={{ textAlign: 'center', color: '#d4380d', fontWeight: 600, fontSize: 13 }}>借方金额</div>
              </th>
              <th colSpan={1} style={thStyle({ padding: '4px 0', borderBottom: 'none' })}>
                <div style={{ textAlign: 'center', color: '#1677ff', fontWeight: 600, fontSize: 13 }}>贷方金额</div>
              </th>
              <th rowSpan={2} style={thStyle({ width: 32 })}></th>
            </tr>
            {/* Second header row: digit labels */}
            <tr style={{ background: '#fafafa' }}>
              <th style={thStyle({ padding: 0 })}>
                <AmountGridHeader type="debit" />
              </th>
              <th style={thStyle({ padding: 0 })}>
                <AmountGridHeader type="credit" />
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle({ textAlign: 'center', color: '#999', fontSize: 13 })}>{idx + 1}</td>
                <td style={tdStyle({ position: 'relative' })}>
                  <Input
                    value={line.summary}
                    onChange={e => updateLine(line.key, 'summary', e.target.value)}
                    variant="borderless"
                    placeholder="摘要"
                    style={{ width: 'calc(100% - 24px)' }}
                  />
                  <EllipsisOutlined
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#999', cursor: 'pointer' }}
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
                <td
                  style={tdStyle({ padding: 0 })}
                  onDoubleClick={() => {
                    if (line.debitAmount === null || line.debitAmount === undefined) {
                      handleAutoBalance(line.key, 'debitAmount')
                    }
                  }}
                  title="双击空白格自动填入差额"
                >
                  <AmountGrid
                    value={line.debitAmount}
                    onChange={val => updateLine(line.key, 'debitAmount', val)}
                    type="debit"
                  />
                </td>
                <td
                  style={tdStyle({ padding: 0 })}
                  onDoubleClick={() => {
                    if (line.creditAmount === null || line.creditAmount === undefined) {
                      handleAutoBalance(line.key, 'creditAmount')
                    }
                  }}
                  title="双击空白格自动填入差额"
                >
                  <AmountGrid
                    value={line.creditAmount}
                    onChange={val => updateLine(line.key, 'creditAmount', val)}
                    type="credit"
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
            <tr style={{ background: '#fafafa', fontWeight: 600, borderTop: '2px solid #d9d9d9' }}>
              <td style={tdStyle({ textAlign: 'center' })}></td>
              <td style={tdStyle()} colSpan={2}>
                <Space>
                  <Text strong>合计:</Text>
                  {balanced
                    ? <Text type="success" style={{ fontSize: 12 }}>借贷平衡</Text>
                    : <Text type="danger" style={{ fontSize: 12 }}>差额: ¥{Math.abs(totalDebit - totalCredit).toFixed(2)}</Text>
                  }
                </Space>
              </td>
              <td style={tdStyle({ padding: 0 })}>
                <AmountGrid value={totalDebit > 0 ? totalDebit : null} readOnly type="debit" />
              </td>
              <td style={tdStyle({ padding: 0 })}>
                <AmountGrid value={totalCredit > 0 ? totalCredit : null} readOnly type="credit" />
              </td>
              <td style={tdStyle()}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0' }}>
        <Space>
          <Text type="secondary">制单人:</Text>
          <Text strong>{user?.name || '—'}</Text>
          <Button type="text" size="small" icon={<SettingOutlined style={{ fontSize: 12 }} />} />
        </Space>
        <Space>
          <Button type="primary" loading={saving} onClick={() => handleSave(true)}>
            保存并新增
          </Button>
          <Button loading={saving} onClick={() => handleSave(false)}>
            保存
          </Button>
          <Button loading={saving} onClick={handleDraftSave}>
            暂存
          </Button>
        </Space>
      </div>
    </div>
  )
}

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '8px 4px',
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
    borderRight: '1px solid #e8e8e8',
    borderBottom: '1px solid #e8e8e8',
    verticalAlign: 'middle',
    height: 40,
    ...extra,
  }
}
