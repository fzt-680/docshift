import { useEffect, useId, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  ariaLabel?: string
  /** 展开方向：默认向下，空间不足时可向上 */
  dropUp?: boolean
}

/**
 * 自定义下拉菜单（替代原生 select）
 * 修复 Chromium/Windows 下原生 select 弹窗定位错乱的问题，
 * 同时提供统一样式与键盘无障碍支持。
 */
export default function FormatSelect({ value, options, onChange, disabled, ariaLabel, dropUp }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)

  /* 点击外部关闭（mousedown 即时响应 + click 兜底覆盖编程式触发） */
  useEffect(() => {
    if (!open) return
    const isOutside = (e: Event) => rootRef.current && !rootRef.current.contains(e.target as Node)
    const onDocDown = (e: MouseEvent) => {
      if (isOutside(e)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('click', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('click', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onToggleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(Math.max(0, options.findIndex((o) => o.value === value)))
      }
    }
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (active >= 0) pick(options[active].value)
    }
  }

  return (
    <div className="fselect" ref={rootRef}>
      <button
        type="button"
        className={'fselect-toggle' + (open ? ' open' : '')}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((o) => !o)
          setActive(Math.max(0, options.findIndex((o) => o.value === value)))
        }}
        onKeyDown={onToggleKey}
      >
        <span className="fselect-value">{current?.label ?? value}</span>
        <span className={'fselect-caret' + (open ? ' up' : '')}>▾</span>
      </button>

      {open && (
        <ul
          className={'fselect-menu' + (dropUp ? ' up' : '')}
          id={listId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={'fselect-option' + (o.value === value ? ' selected' : '') + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
            >
              <span className="fselect-check">{o.value === value ? '✓' : ''}</span>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
