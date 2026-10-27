import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useT } from '../../i18n'
import { formatMmSs } from '../../domain/time'
import { useSetView } from './useSetView'
import { useWakeLock } from './useWakeLock'
import styles from './StageMode.module.css'

export function StageModePage() {
  const t = useT()
  const { id } = useParams()
  const view = useSetView(id)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  useWakeLock(true)
  useEffect(() => {
    if (!running) return
    const h = setInterval(() => setElapsed(e => e + 1), 1000)
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
  return (
    <div className={styles.stage}>
      <header className={styles.bar}>
        <Link to={`/sets/${view.set.id}`} className={styles.exit}>{t('stage.exit')}</Link>
        <span className={`${styles.clock} mono`} data-testid="stage-clock" aria-label={t('stage.elapsed')}>{formatMmSs(elapsed)}</span>
        <button type="button" className={styles.toggle} onClick={() => setRunning(r => !r)}>
          {running ? t('stage.pause') : t('stage.start')}
        </button>
      </header>
      {view.rows.length === 0 ? (
        <p className={styles.notice}>{t('set.emptyOrder')}</p>
      ) : (
        <ol className={styles.list}>
          {view.rows.map(r => (
            <li key={r.itemId} className={styles.item}>
              {r.segue && <p className={styles.segue}>{r.segue}</p>}
              <p className={styles.title} data-testid="stage-title">{r.joke.title}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
