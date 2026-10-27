import { useT } from '../../i18n'

export function SettingsPage() {
  const t = useT()
  return <h1>{t('page.settings')}</h1>
}
