import { useT } from '../../i18n'

export function LibraryPage() {
  const t = useT()
  return <h1>{t('page.library')}</h1>
}
