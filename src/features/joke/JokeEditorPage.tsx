import { useT } from '../../i18n'

export function JokeEditorPage() {
  const t = useT()
  return <h1>{t('page.joke')}</h1>
}
