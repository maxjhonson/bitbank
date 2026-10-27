import { useT } from '../i18n'

export function NotFoundPage() {
  const t = useT()
  return <h1>{t('page.notFound')}</h1>
}
