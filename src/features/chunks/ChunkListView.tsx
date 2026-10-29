import { Link, useNavigate } from 'react-router-dom'
import { createChunk, useChunks, useJokeStats } from '../../db'
import { resolveChunk } from '../../domain/chunks'
import { formatMmSs } from '../../domain/time'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import styles from './Chunks.module.css'

export function ChunkListView() {
  const t = useT()
  const navigate = useNavigate()
  const chunks = useChunks()
  const stats = useJokeStats()

  async function onNew() {
    const c = await createChunk()
    navigate(`/chunks/${c.id}`)
  }

  return (
    <div>
      <div className={styles.listHeader}>
        <span />
        <Button onClick={() => void onNew()}>{t('chunk.new')}</Button>
      </div>
      {chunks && stats && chunks.length === 0 ? (
        <p className={styles.empty}>{t('chunk.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {chunks && stats && chunks.map(c => {
            const r = resolveChunk(c, undefined, stats)
            const title = c.title || t('lib.untitled')
            return (
              <li key={c.id} className={styles.card}>
                <Link to={`/chunks/${c.id}`} className={styles.cardTitle} aria-label={t('chunk.open', { title })}>{title}</Link>
                <span data-testid="chunk-count">{t(r.entries.length === 1 ? 'count.jokes.one' : 'count.jokes', { n: r.entries.length })}</span>
                <span className="mono" data-testid="chunk-time">{formatMmSs(r.sec)}</span>
                <span className="mono" data-testid="chunk-score">{r.score === null ? '–' : r.score.toFixed(1)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
