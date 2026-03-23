import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Tabs, Button, Checkbox, Card, Typography, Space, Tag, Tooltip,
  Modal, Form, Input, Select, Table, Popconfirm, message, Spin, Switch, Empty, Row, Col, Alert,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SettingOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, type ClosingTemplate, type ClosingTemplateLine, type ClosingSummaryItem } from '@/api/client'
import { usePeriodStore } from '@/stores/periodStore'

const { Title, Text } = Typography

// ── Template card ─────────────────────────────────────────

function TemplateCard({
  item, onGenerate, onToggle, onDelete, onSettings, generating,
}: {
  item: ClosingSummaryItem
  onGenerate: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onSettings: (id: string) => void
  generating: string | null
}) {
  const hasAmount = item.transferred > 0 || item.pending > 0
  return (
    <Card
      size="small"
      style={{ width: 220, minHeight: 160, border: '1px solid #e8e8e8', borderRadius: 6, opacity: item.isEnabled ? 1 : 0.6 }}
      bodyStyle={{ padding: '10px 12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <Space size={4}>
          <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
          {item.isSystem && <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>系统</Tag>}
        </Space>
      </div>

      <Space size={4} style={{ marginBottom: 8 }}>
        {!item.isSystem && (
          <Popconfirm title="确认删除此模板？" onConfirm={() => onDelete(item.templateId)} okText="删除" cancelText="取消">
            <Text type="secondary" style={{ fontSize: 12, cursor: 'pointer', color: '#ff4d4f' }}>删除</Text>
          </Popconfirm>
        )}
        <Text
          type="secondary"
          style={{ fontSize: 12, cursor: 'pointer', color: '#1677ff' }}
          onClick={() => onToggle(item.templateId, !item.isEnabled)}
        >{item.isEnabled ? '禁用' : '启用'}</Text>
        <Text
          type="secondary"
          style={{ fontSize: 12, cursor: 'pointer', color: '#1677ff' }}
          onClick={() => onSettings(item.templateId)}
        >设置</Text>
      </Space>

      {item.isEnabled ? (
        hasAmount ? (
          <div style={{ fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text type="secondary">已结转:</Text>
              <Text>{item.transferred.toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary">未结转:</Text>
              <Text style={{ color: item.pending > 0 ? '#fa8c16' : undefined }}>{item.pending.toFixed(2)}</Text>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            <div style={{ marginBottom: 2 }}>请点击【生成凭证】测算金额</div>
          </div>
        )
      ) : (
        <div style={{ height: 48 }} />
      )}

      <Button
        type="default"
        size="small"
        block
        loading={generating === item.templateId}
        onClick={() => onGenerate(item.templateId)}
        disabled={!item.isEnabled}
        style={{ fontSize: 12 }}
      >
        {item.voucherId ? '重新生成凭证' : '生成凭证'}
      </Button>
    </Card>
  )
}

// ── Settings modal ────────────────────────────────────────

function SettingsModal({
  open,
  templates,
  onClose,
  onSave,
  defaultTemplateId,
}: {
  open: boolean
  templates: ClosingTemplate[]
  onClose: () => void
  onSave: (id: string, data: Partial<ClosingTemplate> & { lines?: Partial<ClosingTemplateLine>[] }) => Promise<void>
  defaultTemplateId: string | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultTemplateId)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [lines, setLines] = useState<ClosingTemplateLine[]>([])
  const [leafAccounts, setLeafAccounts] = useState<{ code: string; name: string; isLeaf?: boolean }[]>([])

  useEffect(() => {
    if (open) {
      api.listAccounts(true).then(r => setLeafAccounts(r.data.data.map(a => ({ code: a.code, name: a.name, isLeaf: a.isLeaf }))))
    }
  }, [open])

  useEffect(() => {
    if (defaultTemplateId) setSelectedId(defaultTemplateId)
  }, [defaultTemplateId])

  const selected = templates.find(t => t.id === selectedId) ?? templates[0] ?? null

  useEffect(() => {
    if (!selected) return
    form.setFieldsValue({
      name: selected.name,
      voucherWord: selected.voucherWord,
      summary: selected.summary || '',
      isEnabled: selected.isEnabled,
    })
    setLines(selected.lines.map(l => ({ ...l })))
  }, [selected?.id])

  const enabledTemplates = templates.filter(t => t.isEnabled)
  const disabledTemplates = templates.filter(t => !t.isEnabled)

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await onSave(selected!.id, {
        ...vals,
        lines: selected?.type === 'custom' ? lines.map((l, i) => ({ ...l, lineNo: i + 1 })) : undefined,
      })
      message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => {
    setLines(prev => [...prev, {
      id: `new_${Date.now()}`,
      templateId: selected?.id || '',
      lineNo: prev.length + 1,
      summary: '',
      accountCode: '',
      accountName: '',
      direction: 'debit',
      amountType: 'balance_out',
      ratio: 1.0,
    }])
  }

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  const updateLine = (idx: number, field: keyof ClosingTemplateLine, val: unknown) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: val }
      if (field === 'accountCode') {
        const acc = leafAccounts.find(a => a.code === val)
        if (acc) updated.accountName = acc.name
      }
      return updated
    }))
  }

  const lineColumns: ColumnsType<ClosingTemplateLine> = [
    {
      title: '操作', width: 50,
      render: (_v, _r, i) => (
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeLine(i)} />
      ),
    },
    {
      title: '摘要', dataIndex: 'summary', width: 120,
      render: (v, _r, i) => (
        <Input size="small" value={v} onChange={e => updateLine(i, 'summary', e.target.value)} placeholder="摘要" />
      ),
    },
    {
      title: '会计科目', dataIndex: 'accountCode', width: 200,
      render: (v, _r, i) => (
        <Select
          size="small" style={{ width: '100%' }} value={v || undefined}
          showSearch filterOption={(input, opt) => `${opt?.value} ${opt?.label}`.toLowerCase().includes(input.toLowerCase())}
          onChange={val => updateLine(i, 'accountCode', val)}
          options={leafAccounts.map(a => ({ value: a.code, label: `${a.code} ${a.name}${!a.isLeaf ? ' [上级]' : ''}` }))}
          placeholder="选择科目"
        />
      ),
    },
    {
      title: '方向', dataIndex: 'direction', width: 80,
      render: (v, _r, i) => (
        <Select size="small" value={v} onChange={val => updateLine(i, 'direction', val)} style={{ width: '100%' }}
          options={[{ value: 'debit', label: '借' }, { value: 'credit', label: '贷' }]} />
      ),
    },
    {
      title: '金额(A)', dataIndex: 'amountType', width: 100,
      render: (v, _r, i) => (
        <Select size="small" value={v} onChange={val => updateLine(i, 'amountType', val)} style={{ width: '100%' }}
          options={[
            { value: 'balance_out', label: '余额转出' },
            { value: 'balance_in', label: '转入' },
          ]} />
      ),
    },
    {
      title: '取值比例(B)', dataIndex: 'ratio', width: 90,
      render: (v, _r, i) => (
        <Input size="small" value={`${Math.round(v * 100)}%`}
          onChange={e => {
            const num = parseFloat(e.target.value) / 100
            if (!isNaN(num)) updateLine(i, 'ratio', num)
          }} />
      ),
    },
  ]

  return (
    <Modal
      open={open}
      title="结账凭证模板设置"
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave} disabled={!selected}>保存</Button>,
      ]}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', height: 520 }}>
        {/* Left sidebar */}
        <div style={{ width: 200, borderRight: '1px solid #f0f0f0', padding: '12px 0', overflowY: 'auto', flexShrink: 0 }}>
          {enabledTemplates.length > 0 && (
            <>
              <div style={{ padding: '2px 12px 6px', fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>启用模板</span>
              </div>
              {enabledTemplates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                    background: selectedId === t.id ? '#e6f4ff' : 'transparent',
                    color: selectedId === t.id ? '#1677ff' : undefined,
                  }}
                >{t.name}</div>
              ))}
            </>
          )}
          {disabledTemplates.length > 0 && (
            <>
              <div style={{ padding: '8px 12px 6px', fontSize: 12, color: '#999' }}>禁用模板</div>
              {disabledTemplates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#bbb',
                    background: selectedId === t.id ? '#f5f5f5' : 'transparent',
                  }}
                >{t.name}</div>
              ))}
            </>
          )}
          <div style={{ padding: '12px 8px 0' }}>
            <Button icon={<PlusOutlined />} size="small" block onClick={() => {
              // handled from main page
              message.info('请在主页面点击 + 新增模板')
            }}>新增模板</Button>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {!selected ? (
            <Empty description="请选择模板" />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space>
                  <Text strong style={{ fontSize: 14 }}>
                    {selected.name}
                    {selected.isSystem && ' 凭证设置'}
                    {selected.type === 'system' && <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>系统</Tag>}
                  </Text>
                </Space>
                <Space>
                  <Text type="secondary" style={{ fontSize: 13 }}>启用</Text>
                  <Form.Item name="isEnabled" valuePropName="checked" noStyle>
                    <Switch size="small" />
                  </Form.Item>
                </Space>
              </div>

              <Form form={form} layout="vertical" size="small">
                {selected.type === 'custom' && (
                  <Form.Item label="模板名称" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                )}
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item label="凭证字" name="voucherWord">
                      <Select options={[
                        { value: '记', label: '记' },
                        { value: '收', label: '收' },
                        { value: '付', label: '付' },
                        { value: '转', label: '转' },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item label="凭证摘要" name="summary">
                      <Input placeholder="凭证摘要" />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Custom template: show lines */}
                {selected.type === 'custom' && (
                  <Form.Item label={null}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>取值方式: 按凭证分录逐行指定</Text>
                    </div>
                    <Table
                      size="small"
                      dataSource={lines}
                      columns={lineColumns}
                      rowKey={(_, i) => String(i)}
                      pagination={false}
                      bordered
                      style={{ marginBottom: 8 }}
                    />
                    <Button size="small" icon={<PlusOutlined />} onClick={addLine}>新增行</Button>
                  </Form.Item>
                )}

                {/* System template hint */}
                {selected.type === 'system' && (
                  <div style={{ padding: '12px 16px', background: '#f6f8fa', borderRadius: 6, fontSize: 13, color: '#666' }}>
                    {selected.systemKey === 'depreciation' && '系统将根据固定资产折旧计划自动计算本期折旧额并生成凭证'}
                    {selected.systemKey === 'pnl' && '系统将自动汇总本期所有收入和费用科目余额，结转至本年利润（4102）'}
                    {selected.systemKey === 'cost_of_sales' && '系统将根据库存商品（1405）账户余额结转至主营业务成本（6401）'}
                    {selected.systemKey === 'vat_out' && '系统将根据应交增值税（222101）余额生成增值税转出凭证'}
                    {selected.systemKey === 'surcharge_tax' && '系统将根据增值税余额按12%税率计算城建税及附加税'}
                    {selected.systemKey === 'income_tax' && '系统将根据本期利润按25%税率计算企业所得税'}
                  </div>
                )}
              </Form>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function ClosingPage() {
  const navigate = useNavigate()
  const { currentPeriod, setPeriods } = usePeriodStore()
  const [activeTab, setActiveTab] = useState('period_end')
  const [summary, setSummary] = useState<ClosingSummaryItem[]>([])
  const [templates, setTemplates] = useState<ClosingTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [unpostedVouchers, setUnpostedVouchers] = useState<{ id: string; voucherNo: string; status: string }[]>([])
  const [loadingUnposted, setLoadingUnposted] = useState(false)
  const [postingAll, setPostingAll] = useState(false)
  const [settingsTemplateId, setSettingsTemplateId] = useState<string | null>(null)
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [newTemplateForm] = Form.useForm()

  const loadData = useCallback(async () => {
    if (!currentPeriod) return
    setLoading(true)
    try {
      const [tplRes, sumRes] = await Promise.all([
        api.listClosingTemplates(),
        api.closingSummary(currentPeriod.id),
      ])
      setTemplates(tplRes.data.data)
      setSummary(sumRes.data.data)
    } finally {
      setLoading(false)
    }
  }, [currentPeriod?.id])

  useEffect(() => { loadData() }, [loadData])

  const refreshPeriods = async () => {
    const r = await api.listPeriods()
    setPeriods(r.data.data)
  }

  const handleGenerate = async (templateId: string) => {
    if (!currentPeriod) return
    setGenerating(templateId)
    try {
      await api.generateClosingVoucher(templateId, currentPeriod.id)
      message.success('凭证生成成功')
      await loadData()
    } catch {
      // error handled by interceptor
    } finally {
      setGenerating(null)
    }
  }

  const handleGenerateSelected = async () => {
    if (!currentPeriod || selectedIds.size === 0) {
      message.warning('请先勾选模板')
      return
    }
    for (const id of selectedIds) {
      await handleGenerate(id)
    }
  }

  const handleToggle = async (templateId: string, enabled: boolean) => {
    try {
      await api.updateClosingTemplate(templateId, { isEnabled: enabled })
      await loadData()
    } catch { /* handled */ }
  }

  const handleDelete = async (templateId: string) => {
    try {
      await api.deleteClosingTemplate(templateId)
      message.success('删除成功')
      await loadData()
    } catch { /* handled */ }
  }

  const handleSettingsSave = async (id: string, data: Partial<ClosingTemplate> & { lines?: Partial<ClosingTemplateLine>[] }) => {
    await api.updateClosingTemplate(id, data)
    await loadData()
  }

  const handleClose = async () => {
    if (!currentPeriod) return
    Modal.confirm({
      title: '确认结账',
      content: `确认对 ${currentPeriod.name} 进行结账？结账后将无法新增或修改凭证。`,
      okText: '结账',
      okButtonProps: { danger: true },
      onOk: async () => {
        setClosing(true)
        try {
          await api.closingClose(currentPeriod.id)
          message.success('结账成功')
          await refreshPeriods()
          await loadData()
        } finally {
          setClosing(false)
        }
      },
    })
  }

  const handleReopen = async () => {
    if (!currentPeriod) return
    Modal.confirm({
      title: '确认反结账',
      content: `确认对 ${currentPeriod.name} 进行反结账？`,
      okText: '反结账',
      onOk: async () => {
        setClosing(true)
        try {
          await api.closingReopen(currentPeriod.id)
          message.success('反结账成功')
          await refreshPeriods()
          await loadData()
        } finally {
          setClosing(false)
        }
      },
    })
  }

  const loadUnposted = useCallback(async () => {
    if (!currentPeriod) return
    setLoadingUnposted(true)
    try {
      const res = await api.listVouchers({ periodId: currentPeriod.id, status: 'draft,pending,approved', pageSize: 200, includeLines: false })
      setUnpostedVouchers(res.data.data.map(v => ({ id: v.id, voucherNo: v.voucherNo, status: v.status })))
    } catch {
      setUnpostedVouchers([])
    } finally {
      setLoadingUnposted(false)
    }
  }, [currentPeriod?.id])

  useEffect(() => {
    if (activeTab === 'close') loadUnposted()
  }, [activeTab, loadUnposted])

  const handlePostAll = async () => {
    if (!currentPeriod) return
    setPostingAll(true)
    let success = 0, fail = 0
    for (const v of unpostedVouchers) {
      try {
        if (v.status === 'draft') {
          await api.submitVoucher(v.id)
          await api.approveVoucher(v.id)
        } else if (v.status === 'pending') {
          await api.approveVoucher(v.id)
        }
        await api.postVoucher(v.id)
        success++
      } catch { fail++ }
    }
    if (fail > 0) message.warning(`记账完成：成功 ${success} 张，失败 ${fail} 张`)
    else message.success(`已成功记账 ${success} 张凭证，可以结账了`)
    await loadUnposted()
    setPostingAll(false)
  }

  const handleNewTemplate = async () => {
    const vals = await newTemplateForm.validateFields()
    await api.createClosingTemplate(vals)
    message.success('新增模板成功')
    newTemplateForm.resetFields()
    setNewTemplateOpen(false)
    await loadData()
  }

  const isClosed = currentPeriod?.status === 'closed'
  const allEnabled = summary.filter(s => s.isEnabled)
  const allSelected = allEnabled.length > 0 && allEnabled.every(s => selectedIds.has(s.templateId))

  // Split into sections based on system_key
  const depreciationItems = summary.filter(s => s.systemKey === 'depreciation')
  const otherItems = summary.filter(s => s.systemKey !== 'depreciation')

  return (
    <div style={{ maxWidth: 1200 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'period_end', label: '期末处理' },
          { key: 'close', label: '结账' },
          { key: 'reopen', label: '反结账' },
        ]}
        style={{ marginBottom: 0 }}
      />

      {/* 期末处理 tab */}
      {activeTab === 'period_end' && (
        <div style={{ paddingTop: 16 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Space>
              <Checkbox
                checked={allSelected}
                indeterminate={selectedIds.size > 0 && !allSelected}
                onChange={e => {
                  if (e.target.checked) setSelectedIds(new Set(allEnabled.map(s => s.templateId)))
                  else setSelectedIds(new Set())
                }}
              >全选</Checkbox>
            </Space>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>重新测算</Button>
              <Button
                type="default"
                onClick={handleGenerateSelected}
                disabled={selectedIds.size === 0 || isClosed}
              >生成凭证</Button>
              <Button
                type="primary"
                loading={closing}
                disabled={isClosed}
                onClick={handleClose}
              >结账</Button>
              <Button
                loading={closing}
                disabled={!isClosed}
                onClick={handleReopen}
              >反结账</Button>
            </Space>
          </div>

          {isClosed && (
            <div style={{ marginBottom: 16, padding: '8px 16px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591' }}>
              <Text type="warning">当前期间 <strong>{currentPeriod?.name}</strong> 已结账</Text>
            </div>
          )}

          <Spin spinning={loading}>
            {/* Section 1: Depreciation */}
            {depreciationItems.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5} style={{ marginBottom: 12, fontWeight: 500, color: '#333' }}>折旧计提或期末调汇处理</Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {depreciationItems.map(item => (
                    <div key={item.templateId} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      <Checkbox
                        checked={selectedIds.has(item.templateId)}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(item.templateId) : next.delete(item.templateId)
                          setSelectedIds(next)
                        }}
                        style={{ marginTop: 4 }}
                      />
                      <TemplateCard
                        item={item}
                        onGenerate={handleGenerate}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onSettings={(id) => { setSettingsTemplateId(id); setSettingsOpen(true) }}
                        generating={generating}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Other templates */}
            {otherItems.length > 0 && (
              <div>
                <Title level={5} style={{ marginBottom: 12, fontWeight: 500, color: '#333' }}>其他结转或计提凭证处理</Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
                  {otherItems.map(item => (
                    <div key={item.templateId} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      <Checkbox
                        checked={selectedIds.has(item.templateId)}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(item.templateId) : next.delete(item.templateId)
                          setSelectedIds(next)
                        }}
                        style={{ marginTop: 4 }}
                      />
                      <TemplateCard
                        item={item}
                        onGenerate={handleGenerate}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onSettings={(id) => { setSettingsTemplateId(id); setSettingsOpen(true) }}
                        generating={generating}
                      />
                    </div>
                  ))}
                  {/* Add new template button */}
                  <Tooltip title="新增自定义模板">
                    <div
                      onClick={() => setNewTemplateOpen(true)}
                      style={{
                        width: 36, height: 36, borderRadius: 4, border: '1px dashed #d9d9d9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#999', alignSelf: 'flex-end', marginBottom: 12,
                      }}
                    >
                      <PlusOutlined />
                    </div>
                  </Tooltip>
                </div>
              </div>
            )}

            {summary.length === 0 && !loading && (
              <Empty description="暂无模板，请先初始化" />
            )}
          </Spin>
        </div>
      )}

      {/* 结账 tab */}
      {activeTab === 'close' && (
        <div style={{ paddingTop: 24, maxWidth: 480 }}>
          <Spin spinning={loadingUnposted}>
            {unpostedVouchers.length > 0 && (
              <Alert
                type="warning"
                icon={<ExclamationCircleOutlined />}
                showIcon
                style={{ marginBottom: 16 }}
                message={`当前期间还有 ${unpostedVouchers.length} 张未记账凭证，请先全部记账后再结账`}
                action={
                  <Button
                    size="small"
                    type="primary"
                    loading={postingAll}
                    onClick={handlePostAll}
                  >
                    一键全部记账
                  </Button>
                }
              />
            )}
          </Spin>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Text type="secondary">当前期间</Text>
                <div><Text strong style={{ fontSize: 16 }}>{currentPeriod?.name || '-'}</Text></div>
              </div>
              <div>
                <Text type="secondary">状态</Text>
                <div>
                  {isClosed
                    ? <Tag icon={<CheckCircleOutlined />} color="red">已结账</Tag>
                    : <Tag icon={<CloseCircleOutlined />} color="green">未结账</Tag>
                  }
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                loading={closing}
                disabled={isClosed || unpostedVouchers.length > 0}
                onClick={handleClose}
                block
              >
                执行结账
              </Button>
              {unpostedVouchers.length > 0 && !isClosed && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  请先处理上方未记账凭证后再结账。
                </Text>
              )}
              {unpostedVouchers.length === 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  结账后，当前期间将不允许录入或修改凭证。建议在结账前完成所有期末处理。
                </Text>
              )}
            </Space>
          </Card>
        </div>
      )}

      {/* 反结账 tab */}
      {activeTab === 'reopen' && (
        <div style={{ paddingTop: 24, maxWidth: 480 }}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Text type="secondary">当前期间</Text>
                <div><Text strong style={{ fontSize: 16 }}>{currentPeriod?.name || '-'}</Text></div>
              </div>
              <div>
                <Text type="secondary">状态</Text>
                <div>
                  {isClosed
                    ? <Tag icon={<CheckCircleOutlined />} color="red">已结账</Tag>
                    : <Tag icon={<CloseCircleOutlined />} color="green">未结账</Tag>
                  }
                </div>
              </div>
              <Button
                size="large"
                loading={closing}
                disabled={!isClosed}
                onClick={handleReopen}
                block
              >
                执行反结账
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                反结账后，当前期间将重新开放，可以继续录入凭证。
              </Text>
            </Space>
          </Card>
        </div>
      )}

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        templates={templates}
        defaultTemplateId={settingsTemplateId}
        onClose={() => { setSettingsOpen(false); setSettingsTemplateId(null) }}
        onSave={handleSettingsSave}
      />

      {/* New template modal */}
      <Modal
        open={newTemplateOpen}
        title="新增自定义模板"
        onCancel={() => { setNewTemplateOpen(false); newTemplateForm.resetFields() }}
        onOk={handleNewTemplate}
        okText="创建"
      >
        <Form form={newTemplateForm} layout="vertical">
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如：结转研发支出" />
          </Form.Item>
          <Form.Item label="凭证字" name="voucherWord" initialValue="记">
            <Select options={[
              { value: '记', label: '记' },
              { value: '收', label: '收' },
              { value: '付', label: '付' },
              { value: '转', label: '转' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
