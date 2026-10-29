import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { createSet, duplicateSet, deleteSet, updateSet, useJokeStats, useSets } from '../../db'
import { setTotals, type ResolvedItem } from '../../domain/derive'
import { isChunkItem } from '../../domain/chunks'
import { formatMmSs } from '../../domain/time'
import { Button } from '../../ui/Button/Button'
import { CommitField } from './CommitField'
import styles from './Sets.module.css'

export function SetListPage() {
  const t = useT()
  const sets = useSets()
  const stats = useJokeStats()
  const sorted = [...(sets ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div>
      <div className={styles.listHeader}>
        <h1 className={styles.h1}>{t('page.sets')}</h1>
        <Button onClick={() => void createSet()}>{t('set.new')}</Button>
      </div>
      {sets && sets.length === 0 && (
        <div className={styles.empty}>
          <p>{t('set.empty')}</p>
          <Button onClick={() => void createSet()}>{t('set.emptyCta')}</Button>
        </div>
      )}
      <ul className={styles.list}>
        {sorted.map(s => {
          const resolved: ResolvedItem[] = []
          for (const i of s.items) {
            if (isChunkItem(i)) continue
            const st = stats?.get(i.jokeId)
            if (st) resolved.push({ itemId: i.id, sec: st.sec, score: st.score, jokeScores: [st.score] })
          }
          const totals = setTotals(s, resolved)
          return (
            <li key={s.id} className={styles.listRow}>
              <CommitField
                label={t('set.nameLabel')}
                className={styles.input}
                value={s.name}
                validate={v => v.trim() !== ''}
                onCommit={v => void updateSet(s.id, { name: v.trim() })}
              />
              <span className="mono" data-over={totals.over || undefined}>
                {t('set.totalOf', { total: formatMmSs(totals.totalSec), target: formatMmSs(s.targetSec) })}
              </span>
              <span className={styles.actions}>
                <Link to={`/sets/${s.id}`} className={styles.link} aria-label={t('set.open', { name: s.name })}>
                  {t('set.open', { name: '' }).trim()}
                </Link>
                <Button variant="ghost" aria-label={t('set.duplicateNamed', { name: s.name })} onClick={() => void duplicateSet(s.id)}>
                  {t('set.duplicate')}
                </Button>
                <Button
                  variant="danger"
                  aria-label={t('set.deleteNamed', { name: s.name })}
                  onClick={() => {
                    if (window.confirm(t('set.deleteConfirm', { name: s.name }))) void deleteSet(s.id)
                  }}
                >
                  ×
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
