import type { SetItem } from '../../domain/types'
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { breakApartChunk, setChunkJokeSkipped, updateSetItems } from '../../db'
import { formatMmSs } from '../../domain/time'
import { Tag } from '../../ui/Tag/Tag'
import { CommitField } from './CommitField'
import { moveItem } from './reorder'
import type { ChunkRow, SetRow, SetView } from './useSetView'
import styles from './Sets.module.css'

function ChunkEntries({ row, setId, title }: { row: ChunkRow; setId: string; title: string }) {
  const t = useT()
  return (
    <div className={styles.chunkBody}>
      <ul className={styles.entries} aria-label={t('set.chunk.jokes', { title })}>
        {row.entries.map(e => {
          const jt = e.joke.title || t('lib.untitled')
          return (
            <li key={e.jokeId} className={`${styles.entry} ${e.ticked ? '' : styles.entryOff}`}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={e.ticked}
                  onChange={ev => void setChunkJokeSkipped(setId, row.itemId, e.jokeId, !ev.target.checked)}
                />
                {jt}
              </label>
              {e.joke.status === 'retired' && <span className={styles.badge}>{t('chunk.retired')}</span>}
              <span className="mono">{formatMmSs(e.sec)}</span>
              <span className="mono">{e.score === null ? '–' : e.score.toFixed(1)}</span>
              {e.spokenSegue && <span className={styles.spoken}>{e.spokenSegue}</span>}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className={styles.breakApart}
        disabled={row.tickedCount === 0}
        onClick={() => void breakApartChunk(setId, row.itemId)}
      >
        {t('set.chunk.breakApart')}
      </button>
    </div>
  )
}

function Row({ row, index, view }: { row: SetRow; index: number; view: SetView }) {
  const t = useT()
  const { set } = view
  const [open, setOpen] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.itemId })
  const title = (row.kind === 'chunk' ? row.chunk.title : row.joke.title) || t('lib.untitled')
  const patchItem = (patch: { role?: 'opener' | 'closer'; segue?: string }) =>
    void updateSetItems(set.id, items => items.map(i => (i.id === row.itemId ? ({ ...i, ...patch } as SetItem) : i)))
  return (
    <li
      ref={setNodeRef}
      data-row-index={index}
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.itemMain}>
        <button type="button" ref={setActivatorNodeRef} className={`${styles.handle} no-print`} aria-label={t('set.reorder', { title })} {...attributes} {...listeners}>
          ::
        </button>
        <span className={`${styles.slot} mono`}>{row.slot}</span>
        {row.kind === 'chunk' && (
          <button
            type="button"
            className={`${styles.toggle} no-print`}
            aria-expanded={open}
            aria-label={t(open ? 'set.chunk.collapse' : 'set.chunk.expand', { title })}
            onClick={() => setOpen(o => !o)}
          >
            {open ? '▾' : '▸'}
          </button>
        )}
        <div className={styles.itemBody}>
          {row.kind === 'chunk' ? (
            <>
              <Link to={`/chunks/${row.chunk.id}`} className={styles.itemTitle} data-testid="row-title">{title}</Link>
              <span className={`${styles.chunkCount} mono`}>
                {t(row.tickedCount === 1 ? 'count.jokes.one' : 'count.jokes', { n: row.tickedCount })}
              </span>
            </>
          ) : (
            <>
              <Link to={`/jokes/${row.joke.id}`} className={styles.itemTitle} data-testid="row-title">{title}</Link>
              {row.joke.tags.length > 0 && (
                <span className={styles.tags}>{row.joke.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</span>
              )}
            </>
          )}
        </div>
        {row.role && (
          <span className={styles.roleBadge} data-testid={`role-badge-${row.itemId}`}>{t(`set.role.${row.role}`)}</span>
        )}
        <span className="mono">{formatMmSs(row.sec)}</span>
        <span className="mono">{row.score === null ? '–' : row.score.toFixed(1)}</span>
        <select
          className={`${styles.input} no-print`}
          aria-label={t('set.role')}
          value={row.role ?? ''}
          onChange={e => patchItem({ role: (e.target.value || undefined) as SetRow['role'] })}
        >
          <option value="">{t('set.role.none')}</option>
          <option value="opener">{t('set.role.opener')}</option>
          <option value="closer">{t('set.role.closer')}</option>
        </select>
        <button type="button" className={`${styles.remove} no-print`} aria-label={t('set.remove', { title })} onClick={() => void updateSetItems(set.id, items => items.filter(i => i.id !== row.itemId))}>
          ×
        </button>
      </div>
      <CommitField
        label={t('set.segue')}
        className={`${styles.input} ${styles.segue}`}
        value={row.segue ?? ''}
        placeholder={t('set.segue')}
        onCommit={v => patchItem({ segue: v || undefined })}
      />
      {row.kind === 'chunk' && open && <ChunkEntries row={row} setId={set.id} title={title} />}
    </li>
  )
}

export function RunningOrder({ view }: { view: SetView }) {
  const t = useT()
  const { set, rows } = view
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    void updateSetItems(set.id, items => {
      const from = items.findIndex(i => i.id === active.id)
      const to = items.findIndex(i => i.id === over.id)
      return from < 0 || to < 0 ? items : moveItem(items, from, to)
    })
  }
  return (
    <section aria-label={t('set.runningOrder')}>
      <h2 className={styles.h2}>{t('set.runningOrder')}</h2>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t('set.emptyOrder')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map(r => r.itemId)} strategy={verticalListSortingStrategy}>
            <ol className={styles.order}>
              {rows.map((r, i) => <Row key={r.itemId} row={r} index={i} view={view} />)}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
