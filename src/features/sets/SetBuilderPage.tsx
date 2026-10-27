import { Link, useParams } from 'react-router-dom'
import { useT } from '../../i18n'
import { JokeBank } from './JokeBank'
import { RunningOrder } from './RunningOrder'
import { SetHeader } from './SetHeader'
import { SetStats } from './SetStats'
import { useSetView } from './useSetView'
import styles from './Sets.module.css'

export function SetBuilderPage() {
  const t = useT()
  const { id } = useParams()
  const view = useSetView(id)
  if (view === undefined) return null
  if (view === null) {
    return (
      <div>
        <h1 className={styles.h1}>{t('set.notFound')}</h1>
        <p>{t('set.notFoundHelp')}</p>
        <Link to="/sets" className={styles.link}>{t('set.backToSets')}</Link>
      </div>
    )
  }
  return (
    <div className={styles.page}>
      <SetHeader view={view} />
      <SetStats view={view} />
      <RunningOrder view={view} />
      <JokeBank view={view} />
    </div>
  )
}
