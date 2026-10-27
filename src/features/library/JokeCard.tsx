import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { formatMmSs } from '../../domain/time'
import { DeleteJokeDialog } from '../joke/DeleteJokeDialog'
import { StatusBadge } from '../../ui/StatusBadge/StatusBadge'
import { Tag } from '../../ui/Tag/Tag'
import type { LibraryItem } from './filterJokes'
import styles from './JokeCard.module.css'

export function JokeCard({ item }: { item: LibraryItem }) {
  const t = useT()
  const { joke } = item
  const [deleting, setDeleting] = useState(false)
  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <StatusBadge status={joke.status} />
        <span>
          <span className="mono">{formatMmSs(item.sec)}</span>
          {item.source && <span className={styles.source}> {t(`time.${item.source}`)}</span>}
        </span>
      </div>
      <h2 className={styles.title}>
        <Link to={`/jokes/${joke.id}`} className={styles.link}>
          {joke.title || t('lib.untitled')}
        </Link>
      </h2>
      {joke.premise && <p className={styles.premise}>{joke.premise}</p>}
      {joke.tags.length > 0 && (
        <div className={styles.tags}>
          {joke.tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
      <div className={styles.meta}>
        <span className="mono" aria-label={t('lib.score')}>
          {item.score === null ? '–' : item.score.toFixed(1)}
        </span>
        {item.trend != null && item.trend !== 0 && (
          <span aria-label={t('editor.scoreTrend')}>{item.trend > 0 ? '▲' : '▼'}</span>
        )}
        <span>{t(item.runs === 1 ? 'lib.runs.one' : 'lib.runs', { n: item.runs })}</span>
        <span>{t(item.usedIn === 1 ? 'lib.inSets.one' : 'lib.inSets', { n: item.usedIn })}</span>
        <button type="button" className={styles.delete} aria-label={t('joke.deleteNamed', { title: joke.title || t('lib.untitled') })} onClick={() => setDeleting(true)}>
          {t('joke.delete')}
        </button>
      </div>
      {deleting && (
        <DeleteJokeDialog jokeId={joke.id} title={joke.title} onClose={() => setDeleting(false)} onDeleted={() => setDeleting(false)} />
      )}
    </li>
  )
}
