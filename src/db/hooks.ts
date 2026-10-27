import { useLiveQuery } from 'dexie-react-hooks'
import type { ComedySet, Idea, Joke, Performance, Settings } from '../domain/types'
import { DEFAULT_SETTINGS, db } from './db'

export function useJokes(): Joke[] | undefined {
  return useLiveQuery(() => db.jokes.toArray(), [])
}

export function useJoke(id: string | undefined): Joke | undefined {
  return useLiveQuery(() => (id ? db.jokes.get(id) : undefined), [id])
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

export function useIdeas(): Idea[] | undefined {
  return useLiveQuery(() => db.ideas.toArray(), [])
}

/** Defaults-merged settings; reading never requires a prior write. */
export function useSettings(): Settings {
  const stored = useLiveQuery(async () => (await db.settings.get('settings')) ?? null, [])
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}
