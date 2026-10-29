import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import * as repo from './repo'
import type { ChunkSetItem } from '../domain/types'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function setWith(items: unknown[]) {
  const s = await repo.createSet({ name: 'S' })
  await repo.updateSet(s.id, { items: items as never })
  return s
}

describe('chunks repo', () => {
  it('createChunk has defaults; update and get', async () => {
    const c = await repo.createChunk()
    expect(c.title).toBe('')
    expect(c.items).toEqual([])
    expect(c.notes).toBe('')
    await repo.updateChunk(c.id, { title: 'T' })
    expect((await repo.getChunk(c.id))?.title).toBe('T')
  })

  it('deleteJoke throws JokeInChunkError listing the chunk and deletes nothing', async () => {
    const j = await repo.createJoke({ title: 'J' })
    await repo.addPerformance({ jokeId: j.id, date: '2026-01-01', venue: 'X', score: 5 })
    const s = await setWith([{ id: 'i', kind: 'joke', jokeId: j.id }])
    const c = await repo.createChunk({ title: 'C' })
    expect(await repo.chunksUsingJoke(j.id)).toEqual([])
    await repo.updateChunk(c.id, { items: [{ jokeId: j.id }] })
    const err = await repo.deleteJoke(j.id).catch((e) => e)
    expect(err).toBeInstanceOf(repo.JokeInChunkError)
    expect((err as repo.JokeInChunkError).chunks.map((x) => x.id)).toEqual([c.id])
    expect(await repo.getJoke(j.id)).toBeDefined()
    expect(await db.performances.count()).toBe(1)
    expect((await db.sets.get(s.id))?.items).toHaveLength(1)
  })

  it('deleteJoke still strips a standalone joke item from sets', async () => {
    const j = await repo.createJoke()
    const s = await setWith([{ id: 'i', kind: 'joke', jokeId: j.id }, { id: 'c', kind: 'chunk', chunkId: 'cc' }])
    await repo.deleteJoke(j.id)
    expect((await db.sets.get(s.id))?.items.map((i) => i.id)).toEqual(['c'])
  })

  it('setsUsingJoke only reports direct items', async () => {
    const j = await repo.createJoke()
    const c = await repo.createChunk({ items: [{ jokeId: j.id }] })
    await setWith([{ id: 'c', kind: 'chunk', chunkId: c.id }])
    const direct = await setWith([{ id: 'i', kind: 'joke', jokeId: j.id }])
    expect((await repo.setsUsingJoke(j.id)).map((s) => s.id)).toEqual([direct.id])
  })

  it('deleteChunk removes chunk items from sets and keeps the jokes', async () => {
    const j = await repo.createJoke()
    const c = await repo.createChunk({ items: [{ jokeId: j.id }] })
    const s = await setWith([
      { id: 'a', kind: 'chunk', chunkId: c.id },
      { id: 'b', kind: 'joke', jokeId: j.id },
    ])
    expect((await repo.setsUsingChunk(c.id)).map((x) => x.id)).toEqual([s.id])
    await repo.deleteChunk(c.id)
    expect(await repo.getChunk(c.id)).toBeUndefined()
    expect((await db.sets.get(s.id))?.items.map((i) => i.id)).toEqual(['b'])
    expect(await repo.getJoke(j.id)).toBeDefined()
  })

  it('addChunkToSet appends once', async () => {
    const c = await repo.createChunk()
    const s = await repo.createSet()
    await repo.addChunkToSet(s.id, c.id)
    await repo.addChunkToSet(s.id, c.id)
    const items = (await db.sets.get(s.id))!.items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'chunk', chunkId: c.id })
  })

  it('setChunkJokeSkipped toggles, and prunes stale ids', async () => {
    const c = await repo.createChunk({ items: [{ jokeId: 'a' }, { jokeId: 'b' }] })
    const s = await setWith([{ id: 'i', kind: 'chunk', chunkId: c.id }])
    const skips = async () => ((await db.sets.get(s.id))!.items[0] as ChunkSetItem).skippedJokeIds ?? []
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', true)
    expect(await skips()).toEqual(['a'])
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', true)
    expect(await skips()).toEqual(['a'])
    // reorder keeps the skip
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }, { jokeId: 'a' }] })
    await repo.setChunkJokeSkipped(s.id, 'i', 'b', false)
    expect(await skips()).toEqual(['a'])
    // a joke appended to the chunk is not skipped
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }, { jokeId: 'a' }, { jokeId: 'n' }] })
    await repo.setChunkJokeSkipped(s.id, 'i', 'b', false)
    expect(await skips()).toEqual(['a'])
    // remove then re-add: the stale skip is pruned by the next call, so it resets
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }] })
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }, { jokeId: 'a' }] })
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', false)
    expect(await skips()).toEqual([])
  })

  it('breakApartChunk replaces the item in place with joke items for ticked jokes and skips ones already in the set', async () => {
    const [a, b, c3, d] = await Promise.all(['a', 'b', 'c', 'd'].map((t) => repo.createJoke({ title: t })))
    const ch = await repo.createChunk({
      items: [{ jokeId: a.id, segue: 'x' }, { jokeId: b.id }, { jokeId: c3.id }, { jokeId: d.id }],
    })
    const s = await setWith([
      { id: 'first', kind: 'joke', jokeId: a.id },
      { id: 'ch', kind: 'chunk', chunkId: ch.id, skippedJokeIds: [d.id], role: 'closer', segue: 'S' },
      { id: 'last', kind: 'joke', jokeId: 'zz' },
    ])
    await repo.breakApartChunk(s.id, 'ch')
    const items = (await db.sets.get(s.id))!.items as unknown as { id: string; kind: string; jokeId: string; role?: string; segue?: string }[]
    expect(items.map((i) => i.jokeId)).toEqual([a.id, b.id, c3.id, 'zz'])
    expect(items[0].id).toBe('first')
    expect(items[1]).toMatchObject({ kind: 'joke' })
    expect(items[2]).toMatchObject({ kind: 'joke', role: 'closer', segue: 'S' })
    expect(items[3].id).toBe('last')
  })

  it('duplicateSet keeps chunk items linked with their skips and gives new item ids', async () => {
    const c = await repo.createChunk({ items: [{ jokeId: 'a' }] })
    const s = await setWith([{ id: 'i', kind: 'chunk', chunkId: c.id, skippedJokeIds: ['a'] }])
    const d = await repo.duplicateSet(s.id)
    expect(d.items[0]).toMatchObject({ kind: 'chunk', chunkId: c.id, skippedJokeIds: ['a'] })
    expect(d.items[0].id).not.toBe('i')
  })
})
