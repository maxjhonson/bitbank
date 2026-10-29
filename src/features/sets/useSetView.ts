import { useMemo } from 'react'
import { useChunks, useJokeStats, useSetLookup, type JokeStat } from '../../db'
import { setTotals, weakSpots, type ResolvedItem } from '../../domain/derive'
import { isChunkItem, resolveChunk, type ChunkEntry } from '../../domain/chunks'
import type { Chunk, ComedySet, Joke } from '../../domain/types'

interface RowBase {
  itemId: string
  sec: number
  score: number | null
  slot: number
  role?: 'opener' | 'closer'
  segue?: string
}
export interface JokeRow extends RowBase {
  kind: 'joke'
  joke: Joke
}
export interface ChunkRow extends RowBase {
  kind: 'chunk'
  chunk: Chunk
  entries: (ChunkEntry & { joke: Joke })[]
  tickedCount: number
}
export type SetRow = JokeRow | ChunkRow

export interface SetView {
  set: ComedySet
  rows: SetRow[]
  totals: ReturnType<typeof setTotals>
  /** item ids flagged as weak spots */
  weak: Set<string>
}

/** Resolves set items into display rows and totals input. Items whose joke or chunk is gone are skipped. */
export function resolveSetItems(
  set: ComedySet,
  stats: Map<string, JokeStat>,
  chunks: Chunk[],
): { rows: SetRow[]; resolved: ResolvedItem[] } {
  const chunkById = new Map(chunks.map(c => [c.id, c]))
  const numbers = new Map(Array.from(stats, ([id, st]) => [id, { sec: st.sec, score: st.score }]))
  const rows: SetRow[] = []
  const resolved: ResolvedItem[] = []
  for (const i of set.items) {
    const slot = rows.length + 1
    if (isChunkItem(i)) {
      const chunk = chunkById.get(i.chunkId)
      if (!chunk) continue
      const r = resolveChunk(chunk, i.skippedJokeIds, numbers)
      const entries = r.entries.map(e => ({ ...e, joke: stats.get(e.jokeId)!.joke }))
      rows.push({ kind: 'chunk', itemId: i.id, chunk, entries, tickedCount: r.tickedCount, sec: r.sec, score: r.score, slot, role: i.role, segue: i.segue })
      resolved.push({ itemId: i.id, sec: r.sec, score: r.score, jokeScores: r.entries.filter(e => e.ticked).map(e => e.score) })
    } else {
      const st = stats.get(i.jokeId)
      if (!st) continue
      rows.push({ kind: 'joke', itemId: i.id, joke: st.joke, sec: st.sec, score: st.score, slot, role: i.role, segue: i.segue })
      resolved.push({ itemId: i.id, sec: st.sec, score: st.score, jokeScores: [st.score] })
    }
  }
  return { rows, resolved }
}

/** undefined = loading, null = set not found. Items whose joke or chunk is gone are skipped. */
export function useSetView(id: string | undefined): SetView | undefined | null {
  const set = useSetLookup(id)
  const stats = useJokeStats()
  const chunks = useChunks()
  return useMemo(() => {
    if (set === undefined || !stats || !chunks) return undefined
    if (set === null) return null
    const { rows, resolved } = resolveSetItems(set, stats, chunks)
    return { set, rows, totals: setTotals(set, resolved), weak: new Set(weakSpots(resolved)) }
  }, [set, stats, chunks])
}

/** Percent widths (0-100) for the jokes and buffer segments; never NaN, total capped at 100. */
export function barWidths(jokesSec: number, bufferSec: number, targetSec: number): { jokes: number; buffer: number } {
  if (!(targetSec > 0)) return { jokes: jokesSec > 0 ? 100 : 0, buffer: 0 }
  const jokes = Math.min(100, Math.max(0, (jokesSec / targetSec) * 100))
  const buffer = Math.min(100 - jokes, Math.max(0, (bufferSec / targetSec) * 100))
  return { jokes, buffer }
}
