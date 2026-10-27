import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { updateSet } from '../../db'
import { formatMmSs } from '../../domain/time'
import { Tag } from '../../ui/Tag/Tag'
import { CommitField } from './CommitField'
import { moveItem } from './reorder'
import type { SetRow, SetView } from './useSetView'
import styles from './Sets.module.css'

function Row({ row, index, view }: { row: SetRow; index: number; view: SetView }) {
  const t = useT()
  const { set } = view
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.itemId })
  const title = row.joke.title || t('lib.untitled')
  const patchItem = (patch: Partial<SetView['set']['items'][number]>) =>
    void updateSet(set.id, { items: set.items.map(i => (i.id === row.itemId ? { ...i, ...patch } : i)) })
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
        <div className={styles.itemBody}>
          <Link to={`/jokes/${row.joke.id}`} className={styles.itemTitle} data-testid="row-title">{title}</Link>
          {row.joke.tags.length > 0 && (
            <span className={styles.tags}>{row.joke.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</span>
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
        <button type="button" className={`${styles.remove} no-print`} aria-label={t('set.remove', { title })} onClick={() => void updateSet(set.id, { items: set.items.filter(i => i.id !== row.itemId) })}>
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
    const from = set.items.findIndex(i => i.id === active.id)
    const to = set.items.findIndex(i => i.id === over.id)
    if (from < 0 || to < 0) return
    void updateSet(set.id, { items: moveItem(set.items, from, to) })
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
