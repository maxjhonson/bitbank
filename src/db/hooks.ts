import { isChunkItem } from '../domain/chunks'
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Chunk, ComedySet, Idea, Joke, Performance, Settings } from '../domain/types'
import { jokeScore, jokeTime, runCount, scoreTrend, type TimeSource } from '../domain/derive'
import { REHEARSAL_VENUE } from '../domain/types'
import { DEFAULT_SETTINGS, db } from './db'

export function useJokes(): Joke[] | undefined {
  return useLiveQuery(() => db.jokes.toArray(), [])
}

export function useJoke(id: string | undefined): Joke | undefined {
  return useLiveQuery(() => (id ? db.jokes.get(id) : undefined), [id])
}

/** Like useJoke but distinguishes loading (undefined) from missing (null). */
export function useJokeLookup(id: string | undefined): Joke | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.jokes.get(id)) ?? null) : null), [id])
}

export function usePerformances(jokeId?: string): Performance[] | undefined {
  return useLiveQuery(
    () => (jokeId ? db.performances.where('jokeId').equals(jokeId).toArray() : db.performances.toArray()),
    [jokeId],
  )
}

export function useSets(): ComedySet[] | undefined {
  return useLiveQuery(() => db.sets.toArray(), [])
}

export function useSet(id: string | undefined): ComedySet | undefined {
  return useLiveQuery(() => (id ? db.sets.get(id) : undefined), [id])
}

/** Like useSet but distinguishes loading (undefined) from missing (null). */
export function useSetLookup(id: string | undefined): ComedySet | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.sets.get(id)) ?? null) : null), [id])
}

export function useChunks(): Chunk[] | undefined {
  return useLiveQuery(() => db.chunks.toArray(), [])
}

/** Distinguishes loading (undefined) from missing (null). */
export function useChunkLookup(id: string | undefined): Chunk | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.chunks.get(id)) ?? null) : null), [id])
}

export function useIdeas(): Idea[] | undefined {
  return useLiveQuery(() => db.ideas.toArray(), [])
}

/** Defaults-merged settings; reading never requires a prior write. */
export function useSettings(): Settings {
  const stored = useLiveQuery(async () => (await db.settings.get('settings')) ?? null, [])
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export interface JokeStat {
  joke: Joke
  sec: number
  score: number | null
  source: TimeSource
  trend: number | null
  runs: number
  usedIn: number
  /** has at least one non-rehearsal performance */
  stageTested: boolean
}

/** Per-joke derived stats; undefined while loading. */
export function useJokeStats(): Map<string, JokeStat> | undefined {
  const jokes = useJokes()
  const perfs = usePerformances()
  const sets = useSets()
  const chunks = useChunks()
  const { wordsPerMinute } = useSettings()
  return useMemo(() => {
    if (!jokes || !perfs || !sets || !chunks) return undefined
    const byJoke = new Map<string, Performance[]>()
    for (const p of perfs) {
      const list = byJoke.get(p.jokeId)
      if (list) list.push(p)
      else byJoke.set(p.jokeId, [p])
    }
    const chunkById = new Map(chunks.map(c => [c.id, c]))
    const used = new Map<string, number>()
    for (const s of sets) {
      const ids = new Set<string>()
      for (const i of s.items) {
        if (!isChunkItem(i)) ids.add(i.jokeId)
        else {
          const skip = new Set(i.skippedJokeIds ?? [])
          for (const ci of chunkById.get(i.chunkId)?.items ?? []) if (!skip.has(ci.jokeId)) ids.add(ci.jokeId)
        }
      }
      for (const id of ids) used.set(id, (used.get(id) ?? 0) + 1)
    }
    const out = new Map<string, JokeStat>()
    for (const joke of jokes) {
      const jp = byJoke.get(joke.id) ?? []
      const time = jokeTime(joke, jp, wordsPerMinute)
      out.set(joke.id, {
        joke,
        sec: time.sec,
        source: time.source,
        trend: scoreTrend(jp),
        score: jokeScore(joke, jp),
        runs: runCount(jp),
        usedIn: used.get(joke.id) ?? 0,
        stageTested: jp.some(p => p.venue !== REHEARSAL_VENUE),
      })
    }
    return out
  }, [jokes, perfs, sets, chunks, wordsPerMinute])
}
