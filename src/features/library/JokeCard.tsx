import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { formatMmSs } from '../../domain/time'
import { StatusBadge } from '../../ui/StatusBadge/StatusBadge'
import { Tag } from '../../ui/Tag/Tag'
import type { LibraryItem } from './filterJokes'
import styles from './JokeCard.module.css'

export function JokeCard({ item }: { item: LibraryItem }) {
  const t = useT()
  const { joke } = item
  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <StatusBadge status={joke.status} />
        <span className="mono">{formatMmSs(item.sec)}</span>
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
        <span>{t('lib.runs', { n: item.runs })}</span>
        <span>{t('lib.inSets', { n: item.usedIn })}</span>
      </div>
    </li>
  )
}
