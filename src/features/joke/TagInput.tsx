import { useId, useState } from 'react'
import { useT } from '../../i18n'
import { normalizeTags } from '../../db'
import styles from './TagInput.module.css'

interface Props {
  tags: string[]
  suggestions: string[]
  onChange(tags: string[]): void
}

export function TagInput({ tags, suggestions, onChange }: Props) {
  const t = useT()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()

  const add = (raw: string) => {
    const next = normalizeTags([...tags, raw])
    setText('')
    if (next.length !== tags.length) onChange(next)
  }
  const query = text.trim().replace(/^#+/, '').toLowerCase()
  const options = suggestions.filter(s => !tags.includes(s) && s.includes(query))

  return (
    <div className={styles.wrap}>
      <ul className={styles.chips}>
        {tags.map(tag => (
          <li key={tag} className={styles.chip}>
            <span>#{tag}</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={t('editor.removeTag', { tag })}
              onClick={() => onChange(tags.filter(x => x !== tag))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        className={styles.input}
        aria-label={t('editor.addTag')}
        value={text}
        autoComplete="off"
        onChange={e => setText(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          if (text.trim()) add(text)
        }}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
            e.preventDefault()
            add(text)
          }
        }}
      />
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" aria-label={t('editor.tags')} className={styles.list}>
          {options.map(o => (
            <li
              key={o}
              role="option"
              aria-selected={false}
              className={styles.option}
              onMouseDown={e => e.preventDefault()}
              onClick={() => add(o)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
