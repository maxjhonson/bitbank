import { useT } from '../../i18n'
import { formatMmSs } from '../../domain/time'
import type { TimeSource } from '../../domain/derive'
import type { JokeStatus } from '../../domain/types'
import { StatusBadge } from '../../ui/StatusBadge/StatusBadge'
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
  onStatus(s: JokeStatus): void
  onTags(tags: string[]): void
}

export function SidePanel({ sec, source, score, trend, jokeId, status, tags, tagSuggestions, onStatus, onTags }: Props) {
  const t = useT()
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
      <RehearsalTimer jokeId={jokeId} />
      <PerformanceLog jokeId={jokeId} />
    </aside>
  )
}
