import type { SetView } from './useSetView'

/** Print-only numbered list of big titles; hidden on screen (see global.css). */
export function PrintSetList({ view }: { view: SetView }) {
  return (
    <section className="print-only">
      <h1 className="print-set-name">{view.set.name}</h1>
      <ol className="print-list">
        {view.rows.map(r => <li key={r.itemId}>{r.joke.title}</li>)}
      </ol>
    </section>
  )
}
