import { useT } from '../../i18n'
import type { SetView } from './useSetView'
import styles from './Sets.module.css'

export function SetStats({ view }: { view: SetView }) {
  const t = useT()
  const { rows, totals, weak } = view
  const jobCount = rows.reduce((n, r) => n + (r.kind === 'chunk' ? r.tickedCount : 1), 0)
  const weakTitles = rows.filter(r => weak.has(r.itemId)).map(r => (r.kind === 'chunk' ? r.chunk.title : r.joke.title) || t('lib.untitled'))
  return (
    <section aria-label={t('set.stats')} className={styles.stats}>
      <dl className={styles.statList}>
        <div><dt>{t('set.avgScore')}</dt><dd className="mono" data-testid="stat-avg">{totals.avgScore === null ? '–' : totals.avgScore.toFixed(1)}</dd></div>
        <div><dt>{t('set.jokeCount')}</dt><dd className="mono" data-testid="stat-count">{jobCount}</dd></div>
        <div><dt>{t('set.untested')}</dt><dd className="mono" data-testid="stat-untested">{totals.untestedCount}</dd></div>
      </dl>
      {weakTitles.length > 0 && (
        <p className={styles.weak} data-testid="weak-hint">{t('set.weakHint', { titles: weakTitles.join(', ') })}</p>
      )}
    </section>
  )
}
