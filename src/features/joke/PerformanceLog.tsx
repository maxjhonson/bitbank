import { useState } from 'react'
import { addPerformance, deletePerformance, updatePerformance, usePerformances } from '../../db'
import { ratingToScore, scoreToRating } from '../../domain/rating'
import { formatMmSs, parseMmSs } from '../../domain/time'
import { REHEARSAL_VENUE, type Performance } from '../../domain/types'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import styles from './PerformanceLog.module.css'

const today = () => new Date().toISOString().slice(0, 10)

interface FormState { date: string; venue: string; duration: string; rating: number }

function PerfForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: FormState
  submitLabel: string
  onSubmit(v: { date: string; venue: string; durationSec?: number; score: number }): Promise<void>
  onCancel?(): void
}) {
  const t = useT()
  const [f, setF] = useState(initial)
  const [error, setError] = useState('')
  const rehearsal = f.venue === REHEARSAL_VENUE
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    let durationSec: number | undefined
    if (f.duration.trim() !== '') {
      const d = parseMmSs(f.duration)
      if (d === null) { setError(t('perf.durationError')); return }
      durationSec = d
    }
    setError('')
    await onSubmit({ date: f.date, venue: f.venue.trim(), durationSec, score: rehearsal ? 0 : ratingToScore(f.rating) })
    if (!onCancel) setF({ ...initial, date: f.date })
  }
  return (
    <form className={styles.form} onSubmit={e => void submit(e)}>
      <label>{t('perf.date')}<input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
      <label>{t('perf.venue')}<input value={f.venue} onChange={e => setF({ ...f, venue: e.target.value })} /></label>
      <label>{t('perf.duration')}<input value={f.duration} placeholder="1:15" onChange={e => setF({ ...f, duration: e.target.value })} /></label>
      {!rehearsal && (
        <label>{t('perf.rating')}
          <select value={f.rating} onChange={e => setF({ ...f, rating: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <Button type="submit">{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>{t('perf.cancel')}</Button>}
      </div>
    </form>
  )
}

function Row({ p }: { p: Performance }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const rehearsal = p.venue === REHEARSAL_VENUE
  if (editing) {
    return (
      <li className={styles.item}>
        <PerfForm
          initial={{ date: p.date, venue: p.venue, duration: p.durationSec === undefined ? '' : formatMmSs(p.durationSec), rating: scoreToRating(p.score) || 3 }}
          submitLabel={t('perf.save')}
          onCancel={() => setEditing(false)}
          onSubmit={async v => {
            await updatePerformance(p.id, { date: v.date, venue: v.venue, durationSec: v.durationSec, score: v.score })
            setEditing(false)
          }}
        />
      </li>
    )
  }
  return (
    <li className={styles.item}>
      <div className={styles.summary}>
        <span className="mono">{p.date}</span>
        <span>{p.venue}</span>
        {p.durationSec !== undefined && <span className="mono">{formatMmSs(p.durationSec)}</span>}
        {rehearsal ? <em>{t('perf.rehearsal')}</em> : <span aria-label={t('perf.rating')}>{scoreToRating(p.score)}/5</span>}
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => setEditing(true)}>{t('perf.edit')}</Button>
        <Button variant="danger" onClick={() => void deletePerformance(p.id)}>{t('perf.delete')}</Button>
      </div>
    </li>
  )
}

export function PerformanceLog({ jokeId }: { jokeId: string }) {
  const t = useT()
  const perfs = usePerformances(jokeId) ?? []
  const sorted = [...perfs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  return (
    <section className={styles.log} aria-label={t('perf.title')}>
      <h3 className={styles.heading}>{t('perf.title')}</h3>
      <PerfForm
        initial={{ date: today(), venue: '', duration: '', rating: 3 }}
        submitLabel={t('perf.add')}
        onSubmit={async v => { await addPerformance({ jokeId, ...v }) }}
      />
      {sorted.length === 0 ? <p className={styles.empty}>{t('perf.empty')}</p> : (
        <ul className={styles.list}>{sorted.map(p => <Row key={p.id} p={p} />)}</ul>
      )}
    </section>
  )
}
