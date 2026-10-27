import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createJoke, useJokeStats } from '../../db'
import type { JokeStatus } from '../../domain/types'
import { formatMmSs } from '../../domain/time'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import { Filters } from './Filters'
import { JokeCard } from './JokeCard'
import { filterAndSortJokes, type LibraryQuery } from './filterJokes'
import styles from './LibraryPage.module.css'

type FilterState = Omit<LibraryQuery, 'text' | 'tag'>

export function LibraryPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tag = params.get('tag') || undefined
  const stats = useJokeStats()

  const [searchText, setSearchText] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(searchText), 150)
    return () => clearTimeout(id)
  }, [searchText])

  const [filters, setFilters] = useState<FilterState>({
    statuses: new Set<JokeStatus>(),
    minScore7: false,
    under60: false,
    notInSet: false,
    sort: 'updated',
  })
  const query: LibraryQuery = { ...filters, text: debounced, tag }

  const all = useMemo(() => (stats ? [...stats.values()] : []), [stats])
  const visible = useMemo(
    () => filterAndSortJokes(all, { ...filters, text: debounced, tag }),
    [all, filters, debounced, tag],
  )

  const allTags = useMemo(() => [...new Set([...all.flatMap(s => s.joke.tags), ...(tag ? [tag] : [])])].sort(), [all, tag])
  const totalSec = all.reduce((a, s) => a + s.sec, 0)
  const testedSec = all.reduce((a, s) => a + (s.stageTested ? s.sec : 0), 0)
  const statusCounts: Record<JokeStatus, number> = { draft: 0, working: 0, tight: 0, retired: 0 }
  for (const s of all) statusCounts[s.joke.status]++

  async function onNew() {
    const joke = await createJoke()
    navigate(`/jokes/${joke.id}`, { state: { focusTitle: true } })
  }

  return (
    <section>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>{t('page.library')}</h1>
          <dl className={styles.stats}>
            <div>
              <dt>{t('lib.jokes')}</dt>
              <dd className="mono" data-testid="stat-jokes">{all.length}</dd>
            </div>
            <div>
              <dt>{t('lib.material')}</dt>
              <dd className="mono" data-testid="stat-material">{formatMmSs(totalSec)}</dd>
            </div>
            <div>
              <dt>{t('lib.stageTested')}</dt>
              <dd className="mono" data-testid="stat-tested">{formatMmSs(testedSec)}</dd>
            </div>
          </dl>
        </div>
        <Button onClick={onNew}>{t('lib.new')}</Button>
      </header>
      {stats && all.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('lib.empty')}</p>
          <Button onClick={onNew}>{t('lib.emptyCta')}</Button>
        </div>
      ) : (
        <>
          <Filters
            query={query}
            searchText={searchText}
            onSearch={setSearchText}
            onChange={patch => setFilters(f => ({ ...f, ...patch }))}
            statusCounts={statusCounts}
            onClearTag={() => setParams({})}
            tags={allTags}
            onTag={tg => setParams(tg ? { tag: tg } : {})}
          />
          {visible.length === 0 ? (
            <p className={styles.empty}>{t('lib.noMatch')}</p>
          ) : (
            <ul className={styles.grid}>
              {visible.map(it => (
                <JokeCard key={it.joke.id} item={it} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
