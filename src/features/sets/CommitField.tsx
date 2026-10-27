import { useEffect, useState } from 'react'

interface Props {
  label: string
  value: string
  onCommit: (value: string) => void
  /** return false to reject the value (field reverts) */
  validate?: (value: string) => boolean
  type?: string
  className?: string
  placeholder?: string
}

/** Text input that edits locally and commits on blur/Enter. */
export function CommitField({ label, value, onCommit, validate, type = 'text', className, placeholder }: Props) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft === value) return
    if (validate && !validate(draft)) {
      setDraft(value)
      return
    }
    onCommit(draft)
  }
  return (
    <input
      aria-label={label}
      className={className}
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
