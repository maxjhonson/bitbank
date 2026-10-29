import { useEffect, useMemo, useState } from 'react'
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { updateChunk, useChunkLookup, useJokeStats, useSets, type JokeStat } from '../../db'
import { isChunkItem, resolveChunk } from '../../domain/chunks'
import { formatMmSs } from '../../domain/time'
import type { Chunk } from '../../domain/types'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import { CommitField } from '../sets/CommitField'
import { moveItem } from '../sets/reorder'
import { DeleteChunkDialog } from './DeleteChunkDialog'
import styles from './Chunks.module.css'

type ChunkItems = Chunk['items']

function Row({ index, jokeId, stat, last, chunkId, items }: {
  index: number; jokeId: string; stat: JokeStat; last: boolean; chunkId: string; items: ChunkItems
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: jokeId })
  const title = stat.joke.title || t('lib.untitled')
  const item = items.find(i => i.jokeId === jokeId)
  return (
    <li
      ref={setNodeRef}
      data-row-index={index}
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.itemMain}>
        <button type="button" ref={setActivatorNodeRef} className={styles.handle} aria-label={t('chunk.reorder', { title })} {...attributes} {...listeners}>
          ::
        </button>
        <Link to={`/jokes/${jokeId}`} className={styles.itemTitle} data-testid="row-title">{title}</Link>
        {stat.joke.status === 'retired' && <span className={styles.badge}>{t('chunk.retired')}</span>}
        <span className="mono">{formatMmSs(stat.sec)}</span>
        <span className="mono">{stat.score === null ? '–' : stat.score.toFixed(1)}</span>
        <button
          type="button"
          className={styles.remove}
          aria-label={t('chunk.remove', { title })}
          onClick={() => void updateChunk(chunkId, { items: items.filter(i => i.jokeId !== jokeId) })}
        >
          ×
        </button>
      </div>
      {!last && (
        <CommitField
          label={t('chunk.segue')}
          className={styles.input}
          value={item?.segue ?? ''}
          placeholder={t('chunk.segue')}
          onCommit={v =>
            void updateChunk(chunkId, {
              items: items.map(i => {
                if (i.jokeId !== jokeId) return i
                const { segue: _drop, ...rest } = i
                void _drop
                return v ? { ...rest, segue: v } : rest
              }),
            })
          }
        />
      )}
    </li>
  )
}

function Notes({ chunk }: { chunk: Chunk }) {
  const t = useT()
  const [draft, setDraft] = useState(chunk.notes)
  useEffect(() => setDraft(chunk.notes), [chunk.notes])
  return (
    <label className={styles.field}>
      <span>{t('chunk.notes')}</span>
      <textarea
        className={styles.input}
        rows={3}
        value={draft}
        aria-label={t('chunk.notes')}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => draft !== chunk.notes && void updateChunk(chunk.id, { notes: draft })}
      />
    </label>
  )
}

function Picker({ chunk, stats }: { chunk: Chunk; stats: Map<string, JokeStat> }) {
  const t = useT()
  const [q, setQ] = useState('')
  const inChunk = new Set(chunk.items.map(i => i.jokeId))
  const needle = q.trim().toLowerCase()
  const candidates = [...stats.values()]
    .filter(s => !inChunk.has(s.joke.id))
    .filter(s => !needle || s.joke.title.toLowerCase().includes(needle))
    .sort((a, b) => a.joke.title.localeCompare(b.joke.title))
  return (
    <section className={styles.picker} aria-label={t('chunk.addJoke')}>
      <h2 className={styles.h2}>{t('chunk.addJoke')}</h2>
      <input
        type="search"
        className={styles.input}
        aria-label={t('chunk.search')}
        placeholder={t('chunk.search')}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {candidates.length === 0 ? (
        <p className={styles.empty}>{t('chunk.noPick')}</p>
      ) : (
        <ul className={styles.pickList}>
          {candidates.map(s => {
            const title = s.joke.title || t('lib.untitled')
            return (
              <li key={s.joke.id}>
                <button
                  type="button"
                  className={styles.pickBtn}
                  aria-label={t('chunk.add', { title })}
                  onClick={() => void updateChunk(chunk.id, { items: [...chunk.items, { jokeId: s.joke.id }] })}
                >
                  {title}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function ChunkEditorPage() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const chunk = useChunkLookup(id)
  const stats = useJokeStats()
  const sets = useSets()
  const [deleting, setDeleting] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const resolved = useMemo(() => (chunk && stats ? resolveChunk(chunk, undefined, stats) : null), [chunk, stats])

  if (chunk === undefined || stats === undefined) return null
  if (chunk === null) {
    return (
      <div>
        <h1 className={styles.h1}>{t('chunk.notFound')}</h1>
        <p>{t('chunk.notFoundHelp')}</p>
        <Link to="/?view=chunks" className={styles.link}>{t('chunk.back')}</Link>
      </div>
    )
  }

  // Rows whose joke no longer exists are not rendered.
  const rows = chunk.items.filter(i => stats.has(i.jokeId))
  const usedIn = (sets ?? []).filter(s => s.items.some(i => isChunkItem(i) && i.chunkId === chunk.id))

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!chunk || !over || active.id === over.id) return
    const from = chunk.items.findIndex(i => i.jokeId === active.id)
    const to = chunk.items.findIndex(i => i.jokeId === over.id)
    if (from < 0 || to < 0) return
    void updateChunk(chunk.id, { items: moveItem(chunk.items, from, to) })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/?view=chunks" className={styles.link}>{t('chunk.back')}</Link>
        <Button variant="danger" onClick={() => setDeleting(true)}>{t('chunk.delete')}</Button>
      </div>
      <label className={styles.field}>
        <span>{t('chunk.titleLabel')}</span>
        <CommitField
          label={t('chunk.titleLabel')}
          className={`${styles.input} ${styles.titleInput}`}
          value={chunk.title}
          onCommit={v => void updateChunk(chunk.id, { title: v })}
        />
      </label>
      <dl className={styles.stats}>
        <div>
          <dt>{t('chunk.total')}</dt>
          <dd className="mono" data-testid="chunk-total">{formatMmSs(resolved?.sec ?? 0)}</dd>
        </div>
        <div>
          <dt>{t('chunk.mean')}</dt>
          <dd className="mono" data-testid="chunk-mean">{resolved?.score == null ? '–' : resolved.score.toFixed(1)}</dd>
        </div>
      </dl>
      <Notes chunk={chunk} />
      <section aria-label={t('chunk.jokes')}>
        <h2 className={styles.h2}>{t('chunk.jokes')}</h2>
        {rows.length === 0 ? (
          <p className={styles.empty}>{t('chunk.emptyJokes')}</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map(r => r.jokeId)} strategy={verticalListSortingStrategy}>
              <ol className={styles.order}>
                {rows.map((r, i) => (
                  <Row
                    key={r.jokeId}
                    index={i}
                    jokeId={r.jokeId}
                    stat={stats.get(r.jokeId)!}
                    last={i === rows.length - 1}
                    chunkId={chunk.id}
                    items={chunk.items}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>
      <Picker chunk={chunk} stats={stats} />
      <section>
        <h2 className={styles.h2}>{t('usedIn')}</h2>
        {usedIn.length === 0 ? (
          <p className={styles.empty}>{t('usedIn.none')}</p>
        ) : (
          <ul className={styles.links}>
            {usedIn.map(s => <li key={s.id}><Link to={`/sets/${s.id}`} className={styles.link}>{s.name}</Link></li>)}
          </ul>
        )}
      </section>
      {deleting && (
        <DeleteChunkDialog
          chunkId={chunk.id}
          title={chunk.title}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/?view=chunks')}
        />
      )}
    </div>
  )
}
