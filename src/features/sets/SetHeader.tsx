import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { duplicateSet, updateSet } from '../../db'
import { formatMmSs, parseMmSs } from '../../domain/time'
import { Button } from '../../ui/Button/Button'
import { CommitField } from './CommitField'
import { barWidths, type SetView } from './useSetView'
import styles from './Sets.module.css'

export function SetHeader({ view }: { view: SetView }) {
  const t = useT()
  const { set, totals } = view
  const [badTime, setBadTime] = useState<Record<string, boolean>>({})
  const flag = (key: string, bad: boolean) => setBadTime(b => ({ ...b, [key]: bad }))
  const w = barWidths(totals.jokesSec, set.bufferSec, set.targetSec)
  const over = totals.over
  const timeField = (label: string, key: 'targetSec' | 'bufferSec') => (
    <label className={styles.field}>
      <span>{label}</span>
      <CommitField
        label={label}
        className={styles.input}
        value={formatMmSs(set[key])}
        validate={v => parseMmSs(v) !== null}
        onReject={() => flag(key, true)}
        onAccept={() => flag(key, false)}
        onCommit={v => void updateSet(set.id, { [key]: parseMmSs(v)! })}
      />
      {badTime[key] && <span role="alert" className={styles.fieldError}>{t('set.timeInvalid')}</span>}
    </label>
  )
  return (
    <header className={styles.header}>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>{t('set.name')}</span>
          <CommitField
            label={t('set.name')}
            className={`${styles.input} ${styles.nameInput}`}
            value={set.name}
            validate={v => v.trim() !== ''}
            onCommit={v => void updateSet(set.id, { name: v.trim() })}
          />
        </label>
        <label className={styles.field}>
          <span>{t('set.date')}</span>
          <CommitField label={t('set.date')} type="date" className={styles.input} value={set.date ?? ''} onCommit={v => void updateSet(set.id, { date: v || undefined })} />
        </label>
        <label className={styles.field}>
          <span>{t('set.venue')}</span>
          <CommitField label={t('set.venue')} className={styles.input} value={set.venue ?? ''} onCommit={v => void updateSet(set.id, { venue: v || undefined })} />
        </label>
        {timeField(t('set.target'), 'targetSec')}
        {timeField(t('set.buffer'), 'bufferSec')}
      </div>
      <div className={styles.totalRow}>
        <span className={`${styles.total} mono`} data-testid="set-total">
          {t('set.totalOf', { total: formatMmSs(totals.totalSec), target: formatMmSs(set.targetSec) })}
        </span>
        <span className={`${styles.remaining} ${over ? styles.warn : ''} mono`} data-testid="set-remaining">
          {over ? t('set.over', { time: formatMmSs(-totals.remainingSec) }) : t('set.remaining', { time: formatMmSs(totals.remainingSec) })}
        </span>
      </div>
      <div
        className={`${styles.bar} ${over ? styles.barOver : ''}`}
        role="progressbar"
        aria-label={t('set.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(w.jokes + w.buffer)}
        data-over={over ? 'true' : undefined}
      >
        <span className={styles.barJokes} data-testid="progress-jokes" style={{ width: `${w.jokes}%` }} />
        <span className={styles.barBuffer} data-testid="progress-buffer" style={{ width: `${w.buffer}%` }} />
      </div>
      <div className={`${styles.actions} no-print`}>
        <Button variant="ghost" onClick={() => void duplicateSet(set.id)}>{t('set.duplicate')}</Button>
        <Button variant="ghost" onClick={() => window.print()}>{t('set.print')}</Button>
        <Link to={`/sets/${set.id}/stage`} className={styles.link}>{t('set.stage')}</Link>
      </div>
    </header>
  )
}
