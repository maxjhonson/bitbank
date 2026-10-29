import { useT } from '../../i18n'
import type { SetView } from './useSetView'

/** Print-only numbered list of big titles; hidden on screen (see global.css). */
export function PrintSetList({ view }: { view: SetView }) {
  const t = useT()
  return (
    <section className="print-only">
      <h1 className="print-set-name">{view.set.name}</h1>
      <ol className="print-list">
        {view.rows.map(r => <li key={r.itemId}>{(r.kind === 'chunk' ? r.chunk.title : r.joke.title) || t('lib.untitled')}</li>)}
      </ol>
    </section>
  )
}
