import { useT } from '../../i18n'
import type { Joke } from '../../domain/types'
import { Button } from '../../ui/Button/Button'
import styles from './VersionHistory.module.css'

export function VersionHistory({
  versions,
  onRestore,
}: {
  versions: Joke['versions']
  onRestore(v: Joke['versions'][number]): void
}) {
  const t = useT()
  const list = [...versions].reverse()
  return (
    <section aria-labelledby="versions-h" className={styles.section}>
      <h2 id="versions-h" className={styles.h}>{t('editor.versions')}</h2>
      {list.length === 0 ? (
        <p className={styles.empty}>{t('editor.noVersions')}</p>
      ) : (
        <ul className={styles.list}>
          {list.map(v => {
            const date = new Date(v.savedAt).toLocaleString()
            return (
              <li key={v.savedAt} className={styles.item}>
                <div className={styles.preview}>
                  <span className="mono">{date}</span>
                  <span className={styles.snip}>{(v.setup || v.punchline).slice(0, 80)}</span>
                </div>
                <Button variant="ghost" aria-label={t('editor.restore', { date })} onClick={() => onRestore(v)}>
                  {t('editor.restoreShort')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
