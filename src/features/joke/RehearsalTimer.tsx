import { useState } from 'react'
import { addPerformance } from '../../db'
import { formatMmSs } from '../../domain/time'
import { REHEARSAL_VENUE } from '../../domain/types'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import { useStopwatch } from './useStopwatch'
import styles from './RehearsalTimer.module.css'

export function RehearsalTimer({ jokeId }: { jokeId: string }) {
  const t = useT()
  const sw = useStopwatch()
  const [pending, setPending] = useState<number | null>(null)

  const finish = async (save: boolean) => {
    if (save && pending !== null) {
      await addPerformance({ jokeId, date: new Date().toISOString().slice(0, 10), venue: REHEARSAL_VENUE, durationSec: pending, score: 0 })
    }
    setPending(null)
    sw.reset()
  }

  return (
    <section className={styles.timer} aria-label={t('timer.title')}>
      <h3 className={styles.heading}>{t('timer.title')}</h3>
      <div className={styles.row}>
        <span className="mono" role="timer" aria-label={t('timer.elapsed')}>{formatMmSs(sw.elapsedSec)}</span>
        {sw.running ? (
          <Button onClick={() => setPending(sw.stop())}>{t('timer.stop')}</Button>
        ) : (
          pending === null && <Button onClick={sw.start}>{t('timer.start')}</Button>
        )}
      </div>
      {pending !== null && (
        <div role="dialog" aria-label={t('timer.stopped', { time: formatMmSs(pending) })} className={styles.dialog}>
          <p>{t('timer.stopped', { time: formatMmSs(pending) })}</p>
          <div className={styles.row}>
            <Button onClick={() => void finish(true)}>{t('timer.save')}</Button>
            <Button variant="ghost" onClick={() => void finish(false)}>{t('timer.discard')}</Button>
          </div>
        </div>
      )}
    </section>
  )
}
