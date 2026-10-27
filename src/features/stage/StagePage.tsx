import { useT } from '../../i18n'

export function StagePage() {
  const t = useT()
  return <h1>{t('page.stage')}</h1>
}
