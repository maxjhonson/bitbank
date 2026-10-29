import { breakApart, isChunkItem, resolveChunk } from '../domain/chunks'
import type { Chunk, ChunkSetItem, ComedySet, Idea, Joke, Performance, Settings } from '../domain/types'
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

export class JokeInChunkError extends Error {
  chunks: Chunk[]
  constructor(chunks: Chunk[]) {
    super('Joke is used in a chunk')
    this.name = 'JokeInChunkError'
    this.chunks = chunks
  }
}

export async function deleteJoke(id: string): Promise<void> {
  await db.transaction('rw', db.jokes, db.performances, db.sets, db.chunks, async () => {
    const inChunks = await chunksUsingJoke(id)
    if (inChunks.length) throw new JokeInChunkError(inChunks)
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

export async function createChunk(init: Partial<Chunk> = {}): Promise<Chunk> {
  const ts = now()
  const chunk: Chunk = { title: '', items: [], notes: '', ...init, id: newId(), createdAt: ts, updatedAt: ts }
  await db.chunks.add(chunk)
  return chunk
}

export function getChunk(id: string): Promise<Chunk | undefined> {
  return db.chunks.get(id)
}

export async function updateChunk(id: string, patch: Partial<Chunk>): Promise<void> {
  await db.transaction('rw', db.chunks, db.sets, async () => {
    const ts = now()
    await db.chunks.update(id, { ...patch, updatedAt: ts })
    if (!patch.items) return
    // Drop skip ids for jokes no longer in the chunk, so a re-added joke comes back ticked.
    const inChunk = new Set(patch.items.map((i) => i.jokeId))
    for (const s of await db.sets.toArray()) {
      let changed = false
      const items = s.items.map((i) => {
        if (!isChunkItem(i) || i.chunkId !== id || !i.skippedJokeIds) return i
        const kept = i.skippedJokeIds.filter((j) => inChunk.has(j))
        if (kept.length === i.skippedJokeIds.length) return i
        changed = true
        const { skippedJokeIds: _old, ...rest } = i
        return kept.length ? { ...rest, skippedJokeIds: kept } : rest
      })
      if (changed) await db.sets.update(s.id, { items, updatedAt: ts })
    }
  })
}

export async function deleteChunk(id: string): Promise<void> {
  await db.transaction('rw', db.chunks, db.sets, async () => {
    await db.chunks.delete(id)
    const affected = (await db.sets.toArray()).filter((s) => s.items.some((i) => isChunkItem(i) && i.chunkId === id))
    const ts = now()
    for (const s of affected) {
      await db.sets.update(s.id, {
        items: s.items.filter((i) => !(isChunkItem(i) && i.chunkId === id)),
        updatedAt: ts,
      })
    }
  })
}

export async function chunksUsingJoke(jokeId: string): Promise<Chunk[]> {
  return (await db.chunks.toArray()).filter((c) => c.items.some((i) => i.jokeId === jokeId))
}

export async function setsUsingChunk(chunkId: string): Promise<ComedySet[]> {
  return (await db.sets.toArray()).filter((s) => s.items.some((i) => isChunkItem(i) && i.chunkId === chunkId))
}

/** Appends the chunk to the end of the set; no-op if it is already there. */
export async function addChunkToSet(setId: string, chunkId: string): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(setId)
    if (!set || set.items.some((i) => isChunkItem(i) && i.chunkId === chunkId)) return
    await db.sets.update(setId, { items: [...set.items, { id: newId(), kind: 'chunk', chunkId }], updatedAt: now() })
  })
}

/** Toggles one joke's skip on a set's chunk item, pruning skip ids no longer in the chunk. */
export async function setChunkJokeSkipped(
  setId: string,
  itemId: string,
  jokeId: string,
  skipped: boolean,
): Promise<void> {
  await db.transaction('rw', db.sets, db.chunks, async () => {
    const set = await db.sets.get(setId)
    const item = set?.items.find((i) => i.id === itemId)
    if (!set || !item || !isChunkItem(item)) return
    const chunk = await db.chunks.get(item.chunkId)
    const inChunk = new Set(chunk?.items.map((i) => i.jokeId) ?? [])
    const skip = new Set((item.skippedJokeIds ?? []).filter((id) => inChunk.has(id)))
    if (skipped) skip.add(jokeId)
    else skip.delete(jokeId)
    const { skippedJokeIds: _old, ...rest } = item
    const next: ChunkSetItem = skip.size ? { ...rest, skippedJokeIds: [...skip] } : rest
    await db.sets.update(setId, { items: set.items.map((i) => (i.id === itemId ? next : i)), updatedAt: now() })
  })
}

/** Replaces the chunk item, in place, with joke items for its ticked jokes not already in the set. */
export async function breakApartChunk(setId: string, itemId: string): Promise<void> {
  await db.transaction('rw', db.sets, db.chunks, db.jokes, async () => {
    const set = await db.sets.get(setId)
    const idx = set ? set.items.findIndex((i) => i.id === itemId) : -1
    const item = set?.items[idx]
    if (!set || !item || !isChunkItem(item)) return
    const chunk = await db.chunks.get(item.chunkId)
    if (!chunk) return
    const existing = await db.jokes.bulkGet(chunk.items.map((i) => i.jokeId))
    const nums = new Map<string, { sec: number; score: number | null }>()
    existing.forEach((j) => j && nums.set(j.id, { sec: 0, score: null }))
    const { entries } = resolveChunk(chunk, item.skippedJokeIds, nums)
    const inSet = new Set(set.items.flatMap((i) => (isChunkItem(i) ? [] : [i.jokeId])))
    const jokes = breakApart(item, entries, inSet, newId)
    await db.sets.update(setId, {
      items: [...set.items.slice(0, idx), ...jokes, ...set.items.slice(idx + 1)],
      updatedAt: now(),
    })
  })
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
