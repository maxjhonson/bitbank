import type { Chunk, ChunkSetItem, JokeSetItem, SetItem } from './types'

export type JokeNumbers = { sec: number; score: number | null }

export interface ChunkEntry {
  jokeId: string
  segue?: string
  spokenSegue?: string
  ticked: boolean
  sec: number
  score: number | null
}

/** True only for chunk items; legacy items without a `kind` are jokes. */
export function isChunkItem(item: SetItem): item is ChunkSetItem {
  return (item as { kind?: string }).kind === 'chunk'
}

export function resolveChunk(
  chunk: Chunk,
  skipped: string[] | undefined,
  jokes: Map<string, JokeNumbers>,
): { entries: ChunkEntry[]; sec: number; score: number | null; tickedCount: number } {
  const skip = new Set(skipped ?? [])
  const entries: ChunkEntry[] = []
  for (const ci of chunk.items) {
    const j = jokes.get(ci.jokeId)
    if (!j) continue
    entries.push({ jokeId: ci.jokeId, segue: ci.segue, ticked: !skip.has(ci.jokeId), sec: j.sec, score: j.score })
  }
  let lastTicked = -1
  entries.forEach((e, i) => {
    if (e.ticked) lastTicked = i
  })
  entries.forEach((e, i) => {
    if (e.segue && e.ticked && i < lastTicked) e.spokenSegue = e.segue
  })
  let sec = 0
  const scores: number[] = []
  let tickedCount = 0
  for (const e of entries) {
    if (!e.ticked) continue
    tickedCount++
    sec += e.sec
    if (e.score !== null) scores.push(e.score)
  }
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  return { entries, sec, score, tickedCount }
}

export function breakApart(
  item: ChunkSetItem,
  entries: ChunkEntry[],
  alreadyInSet: Set<string>,
  newId: () => string,
): JokeSetItem[] {
  const ticked = entries.filter(e => e.ticked)
  const all: Omit<JokeSetItem, 'id'>[] = ticked.map((e, i) => {
    const out: Omit<JokeSetItem, 'id'> = { kind: 'joke', jokeId: e.jokeId }
    const seg = i === ticked.length - 1 ? item.segue : e.spokenSegue
    if (seg) out.segue = seg
    if (item.role === 'opener' && i === 0) out.role = 'opener'
    if (item.role === 'closer' && i === ticked.length - 1) out.role = 'closer'
    return out
  })
  return all.filter(o => !alreadyInSet.has(o.jokeId)).map(o => ({ id: newId(), ...o }))
}
