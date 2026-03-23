import { useNavigate, useLocation } from 'react-router-dom'
import { SmileOutlined } from '@ant-design/icons'

export interface ModuleTab {
  key: string
  label: string
  path: string
}

interface Props {
  tabs: ModuleTab[]
}

export default function ModuleTabBar({ tabs }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  // Match by longest prefix
  let activeKey = ''
  let maxLen = 0
  for (const tab of tabs) {
    if (location.pathname === tab.path || location.pathname.startsWith(tab.path + '/')) {
      if (tab.path.length > maxLen) {
        maxLen = tab.path.length
        activeKey = tab.key
      }
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid #e8e8e8',
      padding: '0 16px',
      background: '#fff',
      gap: 0,
      marginBottom: 0,
    }}>
      <span
        style={{ padding: '8px 12px', cursor: 'pointer', color: '#666', fontSize: 14 }}
        onClick={() => navigate('/dashboard')}
      >
        ⌂
      </span>
      {tabs.map(tab => {
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
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </span>
        )
      })}
      <span style={{ padding: '8px 12px', cursor: 'pointer', color: '#999', fontSize: 16 }}>
        <SmileOutlined />
      </span>
    </div>
  )
}
