import { useRef, useCallback } from 'react'

const DIGIT_LABELS = ['亿', '千', '百', '十', '万', '千', '百', '十', '元', '角', '分']
const CELL_COUNT = DIGIT_LABELS.length // 11

interface AmountGridProps {
  value: number | null
  onChange?: (value: number | null) => void
  readOnly?: boolean
  type?: 'debit' | 'credit'
}

/** Convert a number (yuan) to 11-digit array. E.g. 1234.56 -> [0,0,0,0,0,1,2,3,4,5,6] */
function numberToDigits(val: number | null): (number | null)[] {
  if (val === null || val === 0) return new Array(CELL_COUNT).fill(null)
  const isNeg = val < 0
  const abs = Math.abs(val)
  // Convert to fen (分) to avoid floating point issues
  const fen = Math.round(abs * 100)
  const str = fen.toString().padStart(1, '0')

  const digits: (number | null)[] = new Array(CELL_COUNT).fill(null)

  // Fill from right (分位 = index 10, 角位 = index 9, 元位 = index 8, ...)
  for (let i = 0; i < str.length && i < CELL_COUNT; i++) {
    const digitIdx = CELL_COUNT - 1 - i
    digits[digitIdx] = parseInt(str[str.length - 1 - i], 10)
    if (isNeg && i === str.length - 1) digits[digitIdx] = -digits[digitIdx]!
  }

  return digits
}

/** Convert 11-digit array back to number (yuan) */
function digitsToNumber(digits: (number | null)[]): number | null {
  let hasValue = false
  let fen = 0
  for (let i = 0; i < CELL_COUNT; i++) {
    if (digits[i] !== null) {
      hasValue = true
      const placeValue = Math.pow(10, CELL_COUNT - 1 - i)
      fen += digits[i]! * placeValue
    }
  }
  if (!hasValue) return null
  return fen / 100
}

export default function AmountGrid({ value, onChange, readOnly = false, type = 'debit' }: AmountGridProps) {
  const cellRefs = useRef<(HTMLInputElement | null)[]>([])
  const digits = numberToDigits(value)

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return

    const currentDigits = [...numberToDigits(value)]

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      currentDigits[idx] = parseInt(e.key, 10)
      onChange?.(digitsToNumber(currentDigits))
      // Move to next cell
      if (idx < CELL_COUNT - 1) {
        cellRefs.current[idx + 1]?.focus()
      }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      currentDigits[idx] = null
      onChange?.(digitsToNumber(currentDigits))
      if (e.key === 'Backspace' && idx > 0) {
        cellRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault()
      cellRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < CELL_COUNT - 1) {
      e.preventDefault()
      cellRefs.current[idx + 1]?.focus()
    } else if (e.key === 'Tab') {
      // Let tab work naturally for navigation
    } else {
      e.preventDefault()
    }
  }, [value, onChange, readOnly])

  const borderColor = type === 'debit' ? '#f5a623' : '#4a90d9'

  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>
      {DIGIT_LABELS.map((_, idx) => {
        const isYuanSep = idx === 8 // After 元 (index 8), before 角
        const d = digits[idx]

        return (
          <div
            key={idx}
            style={{
              width: 22,
              minWidth: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: idx < CELL_COUNT - 1
                ? isYuanSep
                  ? `2px solid ${borderColor}`
                  : '1px solid #e8e8e8'
                : 'none',
              position: 'relative',
            }}
          >
            <input
              ref={el => { cellRefs.current[idx] = el }}
              type="text"
              readOnly={readOnly}
              value={d !== null ? Math.abs(d).toString() : ''}
              onKeyDown={e => handleKeyDown(idx, e)}
              onFocus={e => e.target.select()}
              onChange={() => {}} // Controlled via onKeyDown
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none',
                textAlign: 'center',
                fontSize: 13,
                padding: 0,
                background: 'transparent',
                cursor: readOnly ? 'default' : 'text',
                color: d !== null ? '#333' : 'transparent',
              }}
              tabIndex={readOnly ? -1 : 0}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Header row for the amount grid showing digit position labels */
export function AmountGridHeader({ type }: { type: 'debit' | 'credit' }) {
  const borderColor = type === 'debit' ? '#f5a623' : '#4a90d9'
  const labelColor = type === 'debit' ? '#d4380d' : '#1677ff'

  return (
    <div style={{ display: 'flex' }}>
      {DIGIT_LABELS.map((label, idx) => {
        const isYuanSep = idx === 8
        return (
          <div
            key={idx}
            style={{
              width: 22,
              minWidth: 22,
              textAlign: 'center',
              fontSize: 11,
              color: labelColor,
              borderRight: idx < CELL_COUNT - 1
                ? isYuanSep
                  ? `2px solid ${borderColor}`
                  : '1px solid #e8e8e8'
                : 'none',
              padding: '2px 0',
            }}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}
