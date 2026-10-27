import { useState } from 'react'
import { addJokeToSet, createSet, useSets } from '../../db'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import styles from './SidePanel.module.css'

export function AddToSetMenu({ jokeId }: { jokeId: string }) {
  const t = useT()
  const sets = useSets()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  async function add(id: string, name: string) {
    const already = sets?.find(s => s.id === id)?.items.some(i => i.jokeId === jokeId)
    await addJokeToSet(id, jokeId)
    if (already) return
    setMsg(t('addToSet.added', { name }))
  }
  async function addNew() {
    const s = await createSet()
    await add(s.id, s.name)
  }
  return (
    <div className={styles.field}>
      <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(o => !o)}>{t('addToSet')}</Button>
      {open && (
        <ul className={styles.links}>
          {(sets ?? []).map(s => {
            const has = s.items.some(i => i.jokeId === jokeId)
            return (
              <li key={s.id}>
                <Button variant="ghost" aria-label={has ? t('addToSet.inSet', { name: s.name }) : s.name} onClick={() => void add(s.id, s.name)}>
                  {has ? `✓ ${s.name}` : s.name}
                </Button>
              </li>
            )
          })}
          <li><Button variant="ghost" onClick={() => void addNew()}>{t('addToSet.new')}</Button></li>
        </ul>
      )}
      <span role="status" className={styles.source}>{msg}</span>
    </div>
  )
}
