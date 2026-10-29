import { useEffect, useRef, useState } from 'react'
import { deleteChunk, setsUsingChunk } from '../../db'
import type { ComedySet } from '../../domain/types'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import styles from '../joke/DeleteJokeDialog.module.css'

interface Props {
  chunkId: string
  title: string
  onClose(): void
  onDeleted(): void
}

export function DeleteChunkDialog({ chunkId, title, onClose, onDeleted }: Props) {
  const t = useT()
  const [sets, setSets] = useState<ComedySet[] | null>(null)
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
    let live = true
    void setsUsingChunk(chunkId).then(s => live && setSets(s))
    return () => { live = false }
  }, [chunkId])
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
      await deleteChunk(chunkId)
    } catch {
      busyRef.current = false
      setBusy(false)
      setFailed(true)
      return
    }
    onDeleted()
  }
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const els = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
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
      <div ref={dialogRef} onKeyDown={trapTab} role="dialog" aria-modal="true" aria-labelledby="del-chunk-title" className={styles.dialog}>
        <h2 id="del-chunk-title" className={styles.title}>{t('chunk.delete')}</h2>
        <p><strong>{title || t('lib.untitled')}</strong></p>
        <p>{t('chunk.deleteBody')}</p>
        {sets && sets.length > 0 && (
          <div data-testid="affected-sets">
            <p>{t('chunk.deleteSets')}</p>
            <ul>{sets.map(s => <li key={s.id}>{s.name}</li>)}</ul>
          </div>
        )}
        {failed && <p role="alert">{t('chunk.deleteFailed')}</p>}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={sets === null || busy} onClick={() => void confirm()}>{t('chunk.delete')}</Button>
        </div>
      </div>
    </div>
  )
}
