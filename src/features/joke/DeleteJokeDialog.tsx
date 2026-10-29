import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { chunksUsingJoke, deleteJoke, JokeInChunkError, setsUsingJoke } from '../../db'
import type { Chunk, ComedySet } from '../../domain/types'
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
  const [blocking, setBlocking] = useState<Chunk[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const opener = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
    const prev = opener.current
    return () => {
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus()
    }
  }, [])
  useEffect(() => {
    if (blocking.length > 0) dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [blocking])
  useEffect(() => {
    let live = true
    void Promise.all([setsUsingJoke(jokeId), chunksUsingJoke(jokeId)]).then(([s, c]) => {
      if (!live) return
      setBlocking(c)
      setSets(s)
    })
    return () => { live = false }
  }, [jokeId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busyRef.current && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  async function confirm() {
    setBusy(true)
    busyRef.current = true
    setFailed(false)
    try {
      await deleteJoke(jokeId)
    } catch (e) {
      busyRef.current = false
      setBusy(false)
      if (e instanceof JokeInChunkError) setBlocking(e.chunks)
      else setFailed(true)
      return
    }
    onDeleted()
  }
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const els = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])
    if (els.length === 0) return
    const first = els[0]
    const last = els[els.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }
  return (
    <div className={styles.backdrop}>
      <div ref={dialogRef} onKeyDown={trapTab} role="dialog" aria-modal="true" aria-labelledby="del-joke-title" className={styles.dialog}>
        <h2 id="del-joke-title" className={styles.title}>{t('joke.deleteTitle')}</h2>
        <p><strong>{title || t('lib.untitled')}</strong></p>
        {blocking.length > 0 ? (
          <>
            <p>{t('joke.deleteInChunks')}</p>
            <ul>{blocking.map(c => <li key={c.id}><Link to={`/chunks/${c.id}`}>{c.title || t('lib.untitled')}</Link></li>)}</ul>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
            </div>
          </>
        ) : (
          <>
            <p>{t('joke.deleteBody')}</p>
            {sets && sets.length > 0 && (
              <div data-testid="affected-sets">
                <p>{t('joke.deleteSets')}</p>
                <ul>{sets.map(s => <li key={s.id}>{s.name}</li>)}</ul>
              </div>
            )}
            {failed && <p role="alert">{t('joke.deleteFailed')}</p>}
            <div className={styles.actions}>
              <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
              <Button variant="danger" disabled={sets === null || busy} onClick={() => void confirm()}>{t('joke.delete')}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
