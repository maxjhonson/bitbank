import { Link } from 'react-router-dom'
import { useSets } from '../../db'
import { useT } from '../../i18n'
import styles from './SidePanel.module.css'

export function UsedIn({ jokeId }: { jokeId: string }) {
  const t = useT()
  const sets = (useSets() ?? []).filter(s => s.items.some(i => i.jokeId === jokeId))
  return (
    <div className={styles.field}>
      <span className={styles.label}>{t('usedIn')}</span>
      {sets.length === 0 ? (
        <span className={styles.source}>{t('usedIn.none')}</span>
      ) : (
        <ul className={styles.links}>
          {sets.map(s => (
            <li key={s.id}><Link to={`/sets/${s.id}`}>{s.name}</Link></li>
          ))}
        </ul>
      )}
    </div>
  )
}
