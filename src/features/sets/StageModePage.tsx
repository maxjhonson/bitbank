import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useT } from '../../i18n'
import { formatMmSs } from '../../domain/time'
import { useSetView } from './useSetView'
import { stageLines } from './stageLines'
import { useWakeLock } from './useWakeLock'
import styles from './StageMode.module.css'

export function StageModePage() {
  const t = useT()
  const { id } = useParams()
  const view = useSetView(id)
  const [running, setRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const accRef = useRef(0)
  const startedAt = useRef(0)
  const toggle = () => {
    if (running) {
      accRef.current += Date.now() - startedAt.current
      setElapsedMs(accRef.current)
      setRunning(false)
    } else {
      startedAt.current = Date.now()
      setRunning(true)
    }
  }
  useWakeLock(true)
  useEffect(() => {
    if (!running) return
    const h = setInterval(() => setElapsedMs(accRef.current + (Date.now() - startedAt.current)), 1000)
    return () => clearInterval(h)
  }, [running])

  if (view === undefined) return null
  if (view === null) {
    return (
      <div className={styles.stage}>
        <h1 className={styles.notice}>{t('set.notFound')}</h1>
        <Link to="/sets" className={styles.exit}>{t('set.backToSets')}</Link>
      </div>
    )
  }
  const lines = stageLines(view.rows)
  return (
    <div className={styles.stage}>
      <header className={styles.bar}>
        <Link to={`/sets/${view.set.id}`} className={styles.exit}>{t('stage.exit')}</Link>
        <span className={`${styles.clock} mono`} data-testid="stage-clock" aria-label={t('stage.elapsed')}>{formatMmSs(Math.floor(elapsedMs / 1000))}</span>
        <button type="button" className={styles.toggle} onClick={toggle}>
          {running ? t('stage.pause') : t('stage.start')}
        </button>
      </header>
      {lines.length === 0 ? (
        <p className={styles.notice}>{t('set.emptyOrder')}</p>
      ) : (
        <ol className={styles.list}>
          {lines.map(l => (
            <li key={l.key}>
              {l.chunkStart && <p className={styles.chunkLabel}>{l.chunkTitle || t('lib.untitled')}</p>}
              <p className={styles.title} data-testid="stage-title">{l.title || t('lib.untitled')}</p>
              {l.segue && <p className={styles.segue}>{l.segue}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
