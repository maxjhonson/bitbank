import type { SetRow } from './useSetView'

export interface StageLine {
  key: string
  title: string
  chunkTitle?: string
  /** true on the first line of a chunk block (show the chunk label here only) */
  chunkStart?: true
  segue?: string
}

/** Flattens set rows into the lines shown on stage and in print: chunks expand to their ticked jokes. */
export function stageLines(rows: SetRow[]): StageLine[] {
  const out: StageLine[] = []
  for (const r of rows) {
    if (r.kind !== 'chunk') {
      out.push({ key: r.itemId, title: r.joke.title, segue: r.segue })
      continue
    }
    const ticked = r.entries.filter(e => e.ticked)
    ticked.forEach((e, i) => {
      const last = i === ticked.length - 1
      const line: StageLine = {
        key: `${r.itemId}:${e.jokeId}`,
        title: e.joke.title,
        chunkTitle: r.chunk.title,
        segue: e.spokenSegue ?? (last ? r.segue : undefined),
      }
      if (i === 0) line.chunkStart = true
      out.push(line)
    })
  }
  return out
}
