import { useNavigate, useLocation } from 'react-router-dom'
import { CloseOutlined, SmileOutlined } from '@ant-design/icons'

interface Tab {
  key: string
  label: string
  path: string
}

const TABS: Tab[] = [
  { key: 'entry', label: '录凭证', path: '/vouchers/new' },
  { key: 'list', label: '查凭证', path: '/vouchers' },
  { key: 'summary', label: '凭证汇总表', path: '/vouchers/summary' },
  { key: 'attachment', label: '原始凭证', path: '/voucher/attachment-manage' },
]

function matchTab(pathname: string): string {
  if (pathname === '/vouchers/new' || pathname.endsWith('/edit')) return 'entry'
  if (pathname === '/vouchers/summary') return 'summary'
  if (pathname === '/voucher/attachment-manage') return 'attachment'
  if (pathname === '/vouchers' || pathname.match(/^\/vouchers\/[^/]+$/)) return 'list'
  return ''
}

export default function VoucherTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeKey = matchTab(location.pathname)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid #e8e8e8',
      padding: '0 16px',
      background: '#fff',
      gap: 0,
    }}>
      <span
        style={{ padding: '8px 12px', cursor: 'pointer', color: '#666', fontSize: 14 }}
        onClick={() => navigate('/dashboard')}
      >
        ⌂
      </span>
      {TABS.map(tab => {
        const isActive = tab.key === activeKey
        return (
          <span
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14,
              color: isActive ? '#1677ff' : '#333',
              borderBottom: isActive ? '2px solid #1677ff' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {isActive && (
              <CloseOutlined
                style={{ fontSize: 10, color: '#999', marginLeft: 4 }}
                onClick={e => { e.stopPropagation() }}
              />
            )}
          </span>
        )
      })}
      <span style={{ padding: '8px 12px', cursor: 'pointer', color: '#999', fontSize: 16 }}>
        <SmileOutlined />
      </span>
    </div>
  )
}
