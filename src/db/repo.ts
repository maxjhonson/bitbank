import { isChunkItem } from '../domain/chunks'
import type { ComedySet, Idea, Joke, Performance, Settings } from '../domain/types'
import { db, getSettings } from './db'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

export function normalizeTags(tags: string[]): string[] {
  const out: string[] = []
  for (const raw of tags) {
    const t = raw.trim().replace(/^#+/, '').trim().toLowerCase()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

export async function createJoke(init: Partial<Joke> = {}): Promise<Joke> {
  const ts = now()
  const joke: Joke = {
    title: '',
    premise: '',
    setup: '',
    punchline: '',
    tagLines: [],
    notes: '',
    status: 'draft',
    versions: [],
    ...init,
    tags: normalizeTags(init.tags ?? []),
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
  }
  await db.jokes.add(joke)
  return joke
}

export function getJoke(id: string): Promise<Joke | undefined> {
  return db.jokes.get(id)
}

export async function updateJoke(id: string, patch: Partial<Joke>): Promise<void> {
  const next: Partial<Joke> = { ...patch, updatedAt: now() }
  if (patch.tags) next.tags = normalizeTags(patch.tags)
  await db.jokes.update(id, next)
}

export async function deleteJoke(id: string): Promise<void> {
  await db.transaction('rw', db.jokes, db.performances, db.sets, async () => {
    await db.jokes.delete(id)
    await db.performances.where('jokeId').equals(id).delete()
    const affected = (await db.sets.toArray()).filter((s) => s.items.some((i) => !isChunkItem(i) && i.jokeId === id))
    const ts = now()
    for (const s of affected) {
      await db.sets.update(s.id, { items: s.items.filter((i) => isChunkItem(i) || i.jokeId !== id), updatedAt: ts })
    }
  })
}

export async function setsUsingJoke(jokeId: string): Promise<ComedySet[]> {
  return (await db.sets.toArray()).filter((s) => s.items.some((i) => !isChunkItem(i) && i.jokeId === jokeId))
}

export async function addPerformance(
  p: Omit<Performance, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Performance> {
  const ts = now()
  const perf: Performance = { ...p, id: newId(), createdAt: ts, updatedAt: ts }
  await db.performances.add(perf)
  return perf
}

export async function updatePerformance(id: string, patch: Partial<Performance>): Promise<void> {
  await db.performances.update(id, { ...patch, updatedAt: now() })
}

export async function deletePerformance(id: string): Promise<void> {
  await db.performances.delete(id)
}

export async function createSet(init: Partial<ComedySet> = {}): Promise<ComedySet> {
  const ts = now()
  const set: ComedySet = {
    name: 'Untitled set',
    targetSec: 900,
    bufferSec: 60,
    items: [],
    ...init,
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
  }
  await db.sets.add(set)
  return set
}

export async function updateSet(id: string, patch: Partial<ComedySet>): Promise<void> {
  await db.sets.update(id, { ...patch, updatedAt: now() })
}

/** Atomic read-modify-write of a set's items inside one rw transaction. */
export async function updateSetItems(
  setId: string,
  fn: (items: ComedySet['items']) => ComedySet['items'],
): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(setId)
    if (!set) return
    await db.sets.update(setId, { items: fn(set.items), updatedAt: now() })
  })
}

/** Appends the joke to the end of the set; no-op if it is already there. */
export async function addJokeToSet(setId: string, jokeId: string): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(setId)
    if (!set || set.items.some((i) => !isChunkItem(i) && i.jokeId === jokeId)) return
    await db.sets.update(setId, { items: [...set.items, { id: newId(), kind: 'joke', jokeId }], updatedAt: now() })
  })
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id)
}

export async function duplicateSet(id: string): Promise<ComedySet> {
  const src = await db.sets.get(id)
  if (!src) throw new Error(`Set not found: ${id}`)
  const ts = now()
  const copy: ComedySet = {
    ...src,
    id: newId(),
    name: `${src.name} (copy)`,
    items: src.items.map((i) => ({ ...i, id: newId() })),
    createdAt: ts,
    updatedAt: ts,
  }
  await db.sets.add(copy)
  return copy
}

export async function addIdea(text: string): Promise<Idea> {
  const ts = now()
  const idea: Idea = { id: newId(), text, createdAt: ts, updatedAt: ts }
  await db.ideas.add(idea)
  return idea
}

export async function deleteIdea(id: string): Promise<void> {
  await db.ideas.delete(id)
}

export async function promoteIdea(id: string): Promise<Joke> {
  return db.transaction('rw', db.ideas, db.jokes, async () => {
    const idea = await db.ideas.get(id)
    if (!idea) throw new Error(`Idea not found: ${id}`)
    if (idea.promotedJokeId) {
      const existing = await db.jokes.get(idea.promotedJokeId)
      if (existing) return existing
    }
    const joke = await createJoke({ premise: idea.text })
    await db.ideas.update(id, { promotedJokeId: joke.id, updatedAt: now() })
    return joke
  })
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings()
    await db.settings.put({ ...current, ...patch, id: 'settings' })
  })
}
