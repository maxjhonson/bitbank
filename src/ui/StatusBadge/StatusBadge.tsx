import { useT } from '../../i18n'
import styles from './StatusBadge.module.css'

export type JokeStatus = 'draft' | 'working' | 'tight' | 'retired'

export function StatusBadge({ status }: { status: JokeStatus }) {
  const t = useT()
  return <span className={`${styles.badge} ${styles[status]}`}>{t(`status.${status}`)}</span>
}
