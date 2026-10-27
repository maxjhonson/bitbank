import { useT } from '../../i18n'
import type { Joke } from '../../domain/types'
import { Button } from '../../ui/Button/Button'
import styles from './TagLinesEditor.module.css'

type Lines = Joke['tagLines']

export function TagLinesEditor({ lines, onChange }: { lines: Lines; onChange(l: Lines): void }) {
  const t = useT()
  const patch = (i: number, p: Partial<Lines[number]>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...p } : l)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= lines.length) return
    const next = [...lines]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = (kind: 'tag' | 'act-out') => onChange([...lines, { id: crypto.randomUUID(), text: '', kind }])

  return (
    <section aria-labelledby="taglines-h" className={styles.section}>
      <h2 id="taglines-h" className={styles.h}>{t('editor.tagLines')}</h2>
      <ul className={styles.list}>
        {lines.map((l, i) => (
          <li key={l.id} className={styles.row}>
            <select aria-label={t('editor.kind')} className={styles.control} value={l.kind} onChange={e => patch(i, { kind: e.target.value as 'tag' | 'act-out' })}>
              <option value="tag">{t('editor.kind.tag')}</option>
              <option value="act-out">{t('editor.kind.act-out')}</option>
            </select>
            <input aria-label={t('editor.lineText')} className={`${styles.control} ${styles.text}`} value={l.text} onChange={e => patch(i, { text: e.target.value })} />
            <Button variant="ghost" aria-label={t('editor.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
            <Button variant="ghost" aria-label={t('editor.moveDown')} disabled={i === lines.length - 1} onClick={() => move(i, 1)}>↓</Button>
            <Button variant="danger" aria-label={t('editor.deleteLine')} onClick={() => onChange(lines.filter((_, k) => k !== i))}>×</Button>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => add('tag')}>{t('editor.addTagLine')}</Button>
        <Button variant="ghost" onClick={() => add('act-out')}>{t('editor.addActOut')}</Button>
      </div>
    </section>
  )
}
