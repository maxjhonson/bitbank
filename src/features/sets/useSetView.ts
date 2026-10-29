import { useMemo } from 'react'
import { useJokeStats, useSetLookup } from '../../db'
import { setTotals, weakSpots, type ResolvedItem } from '../../domain/derive'
import { isChunkItem } from '../../domain/chunks'
import type { ComedySet, Joke, JokeSetItem } from '../../domain/types'

export interface SetRow {
  itemId: string
  joke: Joke
  sec: number
  score: number | null
  slot: number
  role?: 'opener' | 'closer'
  segue?: string
}

export interface SetView {
  set: ComedySet
  rows: SetRow[]
  totals: ReturnType<typeof setTotals>
  /** item ids flagged as weak spots */
  weak: Set<string>
}

/** undefined = loading, null = set not found. Items whose joke is gone are skipped. */
export function useSetView(id: string | undefined): SetView | undefined | null {
  const set = useSetLookup(id)
  const stats = useJokeStats()
  return useMemo(() => {
    if (set === undefined || !stats) return undefined
    if (set === null) return null
    const present = set.items.filter((i): i is JokeSetItem => !isChunkItem(i) && stats.has(i.jokeId))
    const rows: SetRow[] = present.map((i, idx) => {
      const st = stats.get(i.jokeId)!
      return { itemId: i.id, joke: st.joke, sec: st.sec, score: st.score, slot: idx + 1, role: i.role, segue: i.segue }
    })
    const resolved: ResolvedItem[] = rows.map(r => ({ itemId: r.itemId, sec: r.sec, score: r.score, jokeScores: [r.score] }))
    return { set, rows, totals: setTotals(set, resolved), weak: new Set(weakSpots(resolved)) }
  }, [set, stats])
}

/** Percent widths (0-100) for the jokes and buffer segments; never NaN, total capped at 100. */
export function barWidths(jokesSec: number, bufferSec: number, targetSec: number): { jokes: number; buffer: number } {
  if (!(targetSec > 0)) return { jokes: jokesSec > 0 ? 100 : 0, buffer: 0 }
  const jokes = Math.min(100, Math.max(0, (jokesSec / targetSec) * 100))
  const buffer = Math.min(100 - jokes, Math.max(0, (bufferSec / targetSec) * 100))
  return { jokes, buffer }
}
