import { isChunkItem, resolveChunk } from '../../domain/chunks'
import { useMemo, useState } from 'react'
import { useT } from '../../i18n'
import { addChunkToSet, addJokeToSet, useChunks, useJokeStats } from '../../db'
import { formatMmSs } from '../../domain/time'
import { Tag } from '../../ui/Tag/Tag'
import type { SetView } from './useSetView'
import styles from './Sets.module.css'

export function JokeBank({ view }: { view: SetView }) {
  const t = useT()
  const stats = useJokeStats()
  const chunks = useChunks()
  const [query, setQuery] = useState('')
  const [fitsOnly, setFitsOnly] = useState(true)
  const { set, totals } = view
  const list = useMemo(() => {
    if (!stats) return []
    const inSet = new Set(set.items.flatMap(i => (isChunkItem(i) ? [] : [i.jokeId])))
    const q = query.trim().toLowerCase()
    return [...stats.values()]
      .filter(s => !inSet.has(s.joke.id))
      .filter(s => !fitsOnly || s.sec <= totals.remainingSec)
      .filter(s => !q || [s.joke.title, s.joke.premise, ...s.joke.tags].some(f => f.toLowerCase().includes(q)))
      .sort((a, b) => a.joke.title.localeCompare(b.joke.title))
  }, [stats, set.items, query, fitsOnly, totals.remainingSec])
  const chunkList = useMemo(() => {
    if (!stats || !chunks) return []
    const inSet = new Set(set.items.flatMap(i => (isChunkItem(i) ? [i.chunkId] : [])))
    const numbers = new Map(Array.from(stats, ([id, st]) => [id, { sec: st.sec, score: st.score }]))
    const q = query.trim().toLowerCase()
    return chunks
      .filter(c => !inSet.has(c.id))
      .map(c => ({ chunk: c, r: resolveChunk(c, undefined, numbers) }))
      .filter(x => !fitsOnly || x.r.sec <= totals.remainingSec)
      .filter(x => !q || x.chunk.title.toLowerCase().includes(q))
      .sort((a, b) => a.chunk.title.localeCompare(b.chunk.title))
  }, [stats, chunks, set.items, query, fitsOnly, totals.remainingSec])
  return (
    <section className={`${styles.bank} no-print`} aria-label={t('bank.title')}>
      <h2 className={styles.h2}>{t('bank.title')}</h2>
      <div className={styles.bankTools}>
        <input className={styles.input} type="search" aria-label={t('lib.search')} placeholder={t('lib.search')} value={query} onChange={e => setQuery(e.target.value)} />
        <label className={styles.check}>
          <input type="checkbox" checked={fitsOnly} onChange={e => setFitsOnly(e.target.checked)} />
          {t('bank.fitsOnly')}
        </label>
      </div>
      {list.length === 0 ? (
        <p className={styles.empty}>{t('bank.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {list.map(s => {
            const title = s.joke.title || t('lib.untitled')
            return (
              <li key={s.joke.id} className={styles.bankItem}>
                <span className={styles.bankTitle} data-testid="bank-title">{s.joke.title || t('lib.untitled')}</span>
                {s.joke.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
                <span className="mono">{formatMmSs(s.sec)}</span>
                <span className="mono">{s.score === null ? '–' : s.score.toFixed(1)}</span>
                <button type="button" className={styles.remove} aria-label={t('bank.add', { title })} onClick={() => void addJokeToSet(set.id, s.joke.id)}>+</button>
              </li>
            )
          })}
        </ul>
      )}
      {chunkList.length > 0 && (
        <>
          <h3 className={styles.h3}>{t('bank.chunks')}</h3>
          <ul className={styles.list}>
            {chunkList.map(({ chunk, r }) => {
              const title = chunk.title || t('lib.untitled')
              return (
                <li key={chunk.id} className={styles.bankItem}>
                  <span className={styles.bankTitle} data-testid="bank-chunk-title">{title}</span>
                  <span>{t(r.entries.length === 1 ? 'count.jokes.one' : 'count.jokes', { n: r.entries.length })}</span>
                  <span className="mono">{formatMmSs(r.sec)}</span>
                  <span className="mono">{r.score === null ? '–' : r.score.toFixed(1)}</span>
                  <button type="button" className={styles.remove} aria-label={t('bank.addChunk', { title })} onClick={() => void addChunkToSet(set.id, chunk.id)}>+</button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
