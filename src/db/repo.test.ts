import { describe, it, expect, beforeEach } from 'vitest'
import { db, getSettings } from './db'
import * as repo from './repo'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('jokes', () => {
  it('createJoke has defaults', async () => {
    const j = await repo.createJoke()
    expect(j.status).toBe('draft')
    expect(j.title).toBe('')
    expect(j.setup).toBe('')
    expect(j.tags).toEqual([])
    expect(j.tagLines).toEqual([])
    expect(j.versions).toEqual([])
    expect(await repo.getJoke(j.id)).toEqual(j)
  })

  it('updateJoke normalizes tags and bumps updatedAt', async () => {
    const j = await repo.createJoke()
    await new Promise((r) => setTimeout(r, 5))
    await repo.updateJoke(j.id, { tags: ['#Family', ' family ', 'Dad'] })
    const got = await repo.getJoke(j.id)
    expect(got?.tags).toEqual(['family', 'dad'])
    expect(got!.updatedAt > j.updatedAt).toBe(true)
  })

  it('deleteJoke removes performances and strips it from sets', async () => {
    const a = await repo.createJoke()
    const b = await repo.createJoke()
    await repo.addPerformance({ jokeId: a.id, date: '2026-01-01', venue: 'X', score: 6 })
    await repo.addPerformance({ jokeId: b.id, date: '2026-01-01', venue: 'X', score: 6 })
    const s = await repo.createSet()
    await repo.updateSet(s.id, {
      items: [
        { id: 'i1', jokeId: a.id },
        { id: 'i2', jokeId: b.id },
      ],
    })
    expect((await repo.setsUsingJoke(a.id)).map((x) => x.id)).toEqual([s.id])
    await repo.deleteJoke(a.id)
    expect(await repo.getJoke(a.id)).toBeUndefined()
    const perfs = await db.performances.toArray()
    expect(perfs.map((p) => p.jokeId)).toEqual([b.id])
    const set = await db.sets.get(s.id)
    expect(set?.items.map((i) => i.jokeId)).toEqual([b.id])
  })
})

describe('sets', () => {
  it('createSet defaults', async () => {
    const s = await repo.createSet()
    expect(s.name).toBe('Untitled set')
    expect(s.targetSec).toBe(900)
    expect(s.bufferSec).toBe(60)
    expect(s.items).toEqual([])
  })

  it('duplicateSet gives new ids with same jokeIds', async () => {
    const s = await repo.createSet({ name: 'Club' })
    await repo.updateSet(s.id, { items: [{ id: 'a', jokeId: 'j1' }, { id: 'b', jokeId: 'j2', role: 'closer' }] })
    const d = await repo.duplicateSet(s.id)
    expect(d.id).not.toBe(s.id)
    expect(d.name).toBe('Club (copy)')
    expect(d.items.map((i) => i.jokeId)).toEqual(['j1', 'j2'])
    expect(d.items.map((i) => i.id)).not.toContain('a')
    expect(d.items[1].role).toBe('closer')
    await repo.deleteSet(s.id)
    expect(await db.sets.get(s.id)).toBeUndefined()
  })
})

describe('ideas', () => {
  it('promoteIdea creates a draft joke and marks the idea', async () => {
    const idea = await repo.addIdea('airline food')
    const joke = await repo.promoteIdea(idea.id)
    expect(joke.status).toBe('draft')
    expect(joke.premise).toBe('airline food')
    expect((await db.ideas.get(idea.id))?.promotedJokeId).toBe(joke.id)
    await repo.deleteIdea(idea.id)
    expect(await db.ideas.get(idea.id)).toBeUndefined()
  })
})

describe('ideas idempotent', () => {
  it('promoteIdea twice returns the same joke without duplicating', async () => {
    const idea = await repo.addIdea('once')
    const a = await repo.promoteIdea(idea.id)
    const b = await repo.promoteIdea(idea.id)
    expect(b.id).toBe(a.id)
    expect(await db.jokes.count()).toBe(1)
  })
})

describe('ideas re-promote', () => {
  it('re-creates a joke when the promoted joke was deleted', async () => {
    const idea = await repo.addIdea('again')
    const a = await repo.promoteIdea(idea.id)
    await db.jokes.delete(a.id)
    const b = await repo.promoteIdea(idea.id)
    expect(b.id).not.toBe(a.id)
    expect((await db.ideas.get(idea.id))?.promotedJokeId).toBe(b.id)
  })
})

describe('performances', () => {
  it('add, update, delete', async () => {
    const p = await repo.addPerformance({ jokeId: 'j', date: '2026-01-01', venue: 'V', score: 4 })
    await repo.updatePerformance(p.id, { score: 8 })
    expect((await db.performances.get(p.id))?.score).toBe(8)
    await repo.deletePerformance(p.id)
    expect(await db.performances.get(p.id)).toBeUndefined()
  })

  it('updating with durationSec: undefined removes the stored field', async () => {
    const p = await repo.addPerformance({ jokeId: 'j', date: '2026-01-01', venue: 'V', score: 4, durationSec: 60 })
    await repo.updatePerformance(p.id, { durationSec: undefined })
    const got = await db.performances.get(p.id)
    expect(got?.durationSec).toBeUndefined()
    expect('durationSec' in (got as object)).toBe(false)
  })
})

describe('settings', () => {
  it('getSettings creates defaults', async () => {
    const s = await getSettings()
    expect(s).toEqual({ id: 'settings', wordsPerMinute: 150, backupReminderDays: 7 })
    expect(await db.settings.get('settings')).toBeDefined()
  })
  it('updateSettings patches', async () => {
    await repo.updateSettings({ wordsPerMinute: 120 })
    expect((await getSettings()).wordsPerMinute).toBe(120)
    expect((await getSettings()).backupReminderDays).toBe(7)
  })
})
