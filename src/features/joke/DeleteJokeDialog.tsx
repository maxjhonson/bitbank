import { useEffect, useState } from 'react'
import { deleteJoke, setsUsingJoke } from '../../db'
import type { ComedySet } from '../../domain/types'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import styles from './DeleteJokeDialog.module.css'

interface Props {
  jokeId: string
  title: string
  onClose(): void
  onDeleted(): void
}

export function DeleteJokeDialog({ jokeId, title, onClose, onDeleted }: Props) {
  const t = useT()
  const [sets, setSets] = useState<ComedySet[] | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    void setsUsingJoke(jokeId).then(s => live && setSets(s))
    return () => { live = false }
  }, [jokeId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  async function confirm() {
    setBusy(true)
    await deleteJoke(jokeId)
    onDeleted()
  }
  return (
    <div className={styles.backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby="del-joke-title" className={styles.dialog}>
        <h2 id="del-joke-title" className={styles.title}>{t('joke.deleteTitle')}</h2>
        <p><strong>{title || t('lib.untitled')}</strong></p>
        <p>{t('joke.deleteBody')}</p>
        {sets && sets.length > 0 && (
          <div data-testid="affected-sets">
            <p>{t('joke.deleteSets')}</p>
            <ul>{sets.map(s => <li key={s.id}>{s.name}</li>)}</ul>
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={sets === null || busy} onClick={() => void confirm()}>{t('joke.delete')}</Button>
        </div>
      </div>
    </div>
  )
}
