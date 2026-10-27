import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { ratingToScore, scoreToRating } from '../../domain/rating'
import { formatMmSs, parseMmSs } from '../../domain/time'
import type { TimeSource } from '../../domain/derive'
import type { JokeStatus } from '../../domain/types'
import { Button } from '../../ui/Button/Button'
import { StatusBadge } from '../../ui/StatusBadge/StatusBadge'
import { AddToSetMenu } from './AddToSetMenu'
import { UsedIn } from './UsedIn'
import { PerformanceLog } from './PerformanceLog'
import { RehearsalTimer } from './RehearsalTimer'
import { TagInput } from './TagInput'
import styles from './SidePanel.module.css'

const STATUSES: JokeStatus[] = ['draft', 'working', 'tight', 'retired']

interface Props {
  sec: number
  source: TimeSource
  score: number | null
  trend: number | null
  jokeId: string
  status: JokeStatus
  tags: string[]
  tagSuggestions: string[]
  manualTimeSec?: number
  manualScore?: number
  onManualTime(sec: number | undefined): void
  onManualScore(score: number | undefined): void
  onStatus(s: JokeStatus): void
  onTags(tags: string[]): void
}

export function SidePanel({ sec, source, score, trend, jokeId, status, tags, tagSuggestions, manualTimeSec, manualScore, onManualTime, onManualScore, onStatus, onTags }: Props) {
  const t = useT()
  const [timeText, setTimeText] = useState(manualTimeSec === undefined ? '' : formatMmSs(manualTimeSec))
  const [timeError, setTimeError] = useState(false)
  useEffect(() => {
    setTimeText(manualTimeSec === undefined ? '' : formatMmSs(manualTimeSec))
    setTimeError(false)
  }, [manualTimeSec])
  const saveTime = (e: React.FormEvent) => {
    e.preventDefault()
    if (timeText.trim() === '') { setTimeError(false); onManualTime(undefined); return }
    const v = parseMmSs(timeText)
    if (v === null) { setTimeError(true); return }
    setTimeError(false)
    onManualTime(v)
  }
  return (
    <aside className={styles.panel}>
      <dl className={styles.stats}>
        <div>
          <dt>{t('editor.time')}</dt>
          <dd><span className="mono">{formatMmSs(sec)}</span> <span className={styles.source}>{t(`time.${source}`)}</span></dd>
        </div>
        <div>
          <dt>{t('editor.score')}</dt>
          <dd>
            <span className="mono">{score === null ? '–' : score.toFixed(1)}</span>{' '}
            <span className={styles.source} data-testid="score-trend" aria-label={t('editor.scoreTrend')}>
              {trend === null ? '–' : `${trend > 0 ? '▲ +' : trend < 0 ? '▼ ' : '= '}${trend.toFixed(1)}`}
            </span>
          </dd>
        </div>
      </dl>
      <form className={styles.field} onSubmit={saveTime}>
        <label htmlFor="joke-time-override">{t('editor.timeOverride')}</label>
        <div className={styles.statusRow}>
          <input id="joke-time-override" className={styles.select} value={timeText} placeholder="1:15" onChange={e => setTimeText(e.target.value)} />
          <Button type="submit">{t('editor.setOverride')}</Button>
          <Button variant="ghost" onClick={() => { setTimeText(''); setTimeError(false); onManualTime(undefined) }} aria-label={`${t('editor.timeOverride')}: ${t('editor.clearOverride')}`}>{t('editor.clearOverride')}</Button>
        </div>
        {timeError && <p role="alert">{t('editor.timeOverrideError')}</p>}
      </form>
      <div className={styles.field}>
        <label htmlFor="joke-manual-score">{t('editor.manualScore')}</label>
        <div className={styles.statusRow}>
          <select
            id="joke-manual-score"
            className={styles.select}
            value={manualScore === undefined ? '' : String(scoreToRating(manualScore))}
            onChange={e => onManualScore(e.target.value === '' ? undefined : ratingToScore(Number(e.target.value)))}
          >
            <option value="">�</option>
            {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button variant="ghost" onClick={() => onManualScore(undefined)} aria-label={`${t('editor.manualScore')}: ${t('editor.clearOverride')}`}>{t('editor.clearOverride')}</Button>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="joke-status">{t('editor.status')}</label>
        <div className={styles.statusRow}>
          <StatusBadge status={status} />
          <select id="joke-status" className={styles.select} value={status} onChange={e => onStatus(e.target.value as JokeStatus)}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>{t('editor.tags')}</span>
        <TagInput tags={tags} suggestions={tagSuggestions} onChange={onTags} />
      </div>
      <UsedIn jokeId={jokeId} />
      <AddToSetMenu jokeId={jokeId} />
      <RehearsalTimer jokeId={jokeId} />
      <PerformanceLog jokeId={jokeId} />
    </aside>
  )
}
