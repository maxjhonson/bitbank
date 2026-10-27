import { useT } from '../../i18n'

export function NotebookPage() {
  const t = useT()
  return <h1>{t('page.notebook')}</h1>
}
