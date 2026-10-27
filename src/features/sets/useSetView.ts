import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, useJokeStats } from '../../db'
import { setTotals, weakSpots } from '../../domain/derive'
import type { ComedySet, Joke } from '../../domain/types'

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
  const set = useLiveQuery(async () => (id ? ((await db.sets.get(id)) ?? null) : null), [id])
  const stats = useJokeStats()
  return useMemo(() => {
    if (set === undefined || !stats) return undefined
    if (set === null) return null
    const present = set.items.filter(i => stats.has(i.jokeId))
    const rows: SetRow[] = present.map((i, idx) => {
      const st = stats.get(i.jokeId)!
      return { itemId: i.id, joke: st.joke, sec: st.sec, score: st.score, slot: idx + 1, role: i.role, segue: i.segue }
    })
    const visible = { ...set, items: present }
    const byJoke = new Map<string, { sec: number; score: number | null }>()
    const scores = new Map<string, number | null>()
    for (const i of present) {
      const st = stats.get(i.jokeId)!
      byJoke.set(i.jokeId, { sec: st.sec, score: st.score })
      scores.set(i.jokeId, st.score)
    }
    return { set, rows, totals: setTotals(visible, byJoke), weak: new Set(weakSpots(visible, scores)) }
  }, [set, stats])
}

/** Percent widths (0-100) for the jokes and buffer segments; never NaN, total capped at 100. */
export function barWidths(jokesSec: number, bufferSec: number, targetSec: number): { jokes: number; buffer: number } {
  if (!(targetSec > 0)) return { jokes: jokesSec > 0 ? 100 : 0, buffer: 0 }
  const jokes = Math.min(100, Math.max(0, (jokesSec / targetSec) * 100))
  const buffer = Math.min(100 - jokes, Math.max(0, (bufferSec / targetSec) * 100))
  return { jokes, buffer }
}
