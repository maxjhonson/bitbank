import { useT, type TKey } from '../../i18n'
import type { JokeStatus } from '../../domain/types'
import { Chip } from '../../ui/Chip/Chip'
import type { LibraryQuery } from './filterJokes'
import styles from './Filters.module.css'

const STATUSES: JokeStatus[] = ['draft', 'working', 'tight', 'retired']
const SORTS: LibraryQuery['sort'][] = ['score', 'time', 'updated', 'title']

interface Props {
  query: LibraryQuery
  searchText: string
  onSearch: (text: string) => void
  onChange: (patch: Partial<LibraryQuery>) => void
  statusCounts: Record<JokeStatus, number>
  onClearTag: () => void
}

export function Filters({ query, searchText, onSearch, onChange, statusCounts, onClearTag }: Props) {
  const t = useT()
  const toggleStatus = (s: JokeStatus) => {
    const next = new Set(query.statuses)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    onChange({ statuses: next })
  }
  return (
    <div className={styles.filters}>
      <div className={styles.row}>
        <input
          type="search"
          className={styles.search}
          aria-label={t('lib.search')}
          placeholder={t('lib.search')}
          value={searchText}
          onChange={e => onSearch(e.target.value)}
        />
        <label className={styles.sort}>
          {t('lib.sort')}
          <select value={query.sort} onChange={e => onChange({ sort: e.target.value as LibraryQuery['sort'] })}>
            {SORTS.map(s => (
              <option key={s} value={s}>
                {t(`lib.sort.${s}` as TKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.row} role="group" aria-label={t('lib.filters')}>
        {STATUSES.map(s => (
          <Chip key={s} selected={query.statuses.has(s)} onClick={() => toggleStatus(s)}>
            {t(`status.${s}`)} {statusCounts[s]}
          </Chip>
        ))}
        <Chip selected={query.minScore7} onClick={() => onChange({ minScore7: !query.minScore7 })}>
          {t('lib.score7')}
        </Chip>
        <Chip selected={query.under60} onClick={() => onChange({ under60: !query.under60 })}>
          {t('lib.under60')}
        </Chip>
        <Chip selected={query.notInSet} onClick={() => onChange({ notInSet: !query.notInSet })}>
          {t('lib.notInSet')}
        </Chip>
        {query.tag && (
          <Chip selected onClick={onClearTag} aria-label={t('lib.clearTag')}>
            {t('lib.tag', { tag: query.tag })} ×
          </Chip>
        )}
      </div>
    </div>
  )
}
