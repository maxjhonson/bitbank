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

  it('setChunkJokeSkipped toggles on and off', async () => {
    const c = await repo.createChunk({ items: [{ jokeId: 'a' }, { jokeId: 'b' }] })
    const s = await setWith([{ id: 'i', kind: 'chunk', chunkId: c.id }])
    const item = async () => (await db.sets.get(s.id))!.items[0] as ChunkSetItem
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', true)
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', true)
    expect((await item()).skippedJokeIds).toEqual(['a'])
    await repo.setChunkJokeSkipped(s.id, 'i', 'b', true)
    expect((await item()).skippedJokeIds).toEqual(['a', 'b'])
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', false)
    await repo.setChunkJokeSkipped(s.id, 'i', 'b', false)
    expect((await item()).skippedJokeIds).toBeUndefined()
  })

  it('updateChunk prunes stale skips from sets, so remove then re-add resets to ticked', async () => {
    const c = await repo.createChunk({ items: [{ jokeId: 'a' }, { jokeId: 'b' }] })
    const s = await setWith([{ id: 'i', kind: 'chunk', chunkId: c.id }])
    const other = await setWith([{ id: 'x', kind: 'joke', jokeId: 'a' }])
    const item = async () => (await db.sets.get(s.id))!.items[0] as ChunkSetItem
    await repo.setChunkJokeSkipped(s.id, 'i', 'a', true)
    await repo.setChunkJokeSkipped(s.id, 'i', 'b', true)
    const otherBefore = (await db.sets.get(other.id))!.updatedAt
    // reorder keeps skips on jokes that stay
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }, { jokeId: 'a' }] })
    expect((await item()).skippedJokeIds).toEqual(['a', 'b'])
    // a joke appended to the chunk is not skipped
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }, { jokeId: 'a' }, { jokeId: 'n' }] })
    expect((await item()).skippedJokeIds).toEqual(['a', 'b'])
    // remove 'a': its skip is pruned immediately, 'b' keeps its skip
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }] })
    expect((await item()).skippedJokeIds).toEqual(['b'])
    // re-add 'a': it comes back ticked
    await repo.updateChunk(c.id, { items: [{ jokeId: 'b' }, { jokeId: 'a' }] })
    expect((await item()).skippedJokeIds).toEqual(['b'])
    // removing every skipped joke omits the field
    await repo.updateChunk(c.id, { items: [{ jokeId: 'a' }] })
    expect((await item()).skippedJokeIds).toBeUndefined()
    expect((await db.sets.get(other.id))!.updatedAt).toBe(otherBefore)
  })

  it('updateChunkItems applies fn to the latest stored items, so stale-snapshot writes both land', async () => {
    const c = await repo.createChunk({ items: [{ jokeId: 'a' }] })
    const stale = c.items
    await repo.updateChunkItems(c.id, () => [...stale, { jokeId: 'b' }])
    await repo.updateChunkItems(c.id, (items) => [...items, { jokeId: 'c' }])
    expect((await repo.getChunk(c.id))!.items.map((i) => i.jokeId)).toEqual(['a', 'b', 'c'])
    // fn receives stored items, not the stale snapshot
    let seen: string[] = []
    await repo.updateChunkItems(c.id, (items) => { seen = items.map((i) => i.jokeId); return items })
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('updateChunkItems prunes stale skips and bumps updatedAt', async () => {
    const c = await repo.createChunk({ items: [{ jokeId: 'a' }, { jokeId: 'b' }] })
    const s = await setWith([{ id: 'i', kind: 'chunk', chunkId: c.id, skippedJokeIds: ['a', 'b'] }])
    await new Promise((r) => setTimeout(r, 5))
    await repo.updateChunkItems(c.id, (items) => items.filter((i) => i.jokeId !== 'a'))
    expect(((await db.sets.get(s.id))!.items[0] as ChunkSetItem).skippedJokeIds).toEqual(['b'])
    expect((await repo.getChunk(c.id))!.updatedAt > c.updatedAt).toBe(true)
  })

  it('updateChunk bumps updatedAt', async () => {
    const c = await repo.createChunk()
    await new Promise((r) => setTimeout(r, 5))
    await repo.updateChunk(c.id, { title: 'T' })
    expect((await repo.getChunk(c.id))!.updatedAt > c.updatedAt).toBe(true)
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
