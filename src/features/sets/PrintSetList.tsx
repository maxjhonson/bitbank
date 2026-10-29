import { useT } from '../../i18n'
import { stageLines } from './stageLines'
import type { SetView } from './useSetView'

/** Print-only numbered list of big titles; hidden on screen (see global.css). */
export function PrintSetList({ view }: { view: SetView }) {
  const t = useT()
  return (
    <section className="print-only">
      <h1 className="print-set-name">{view.set.name}</h1>
      <ol className="print-list">
        {stageLines(view.rows).map(l => (
          <li key={l.key}>
            {l.chunkStart && <small className="print-chunk">{l.chunkTitle || t('lib.untitled')}</small>}
            {l.title || t('lib.untitled')}
          </li>
        ))}
      </ol>
    </section>
  )
}
