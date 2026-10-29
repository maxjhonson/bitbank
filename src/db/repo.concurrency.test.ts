import { beforeEach, describe, expect, it } from 'vitest'
import { db, getSettings } from './db'
import { createJoke, createSet, updateSetItems, updateSettings } from './repo'

beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())) })

describe('atomic updates', () => {
  it('concurrent updateSettings keep both fields', async () => {
    await Promise.all([updateSettings({ wordsPerMinute: 200 }), updateSettings({ backupReminderDays: 3 })])
    const s = await getSettings()
    expect(s.wordsPerMinute).toBe(200)
    expect(s.backupReminderDays).toBe(3)
  })

  it('concurrent updateSetItems (segue + remove on another row) keeps both', async () => {
    const a = await createJoke(); const b = await createJoke()
    const s = await createSet({ items: [{ id: 'i1', kind: 'joke', jokeId: a.id }, { id: 'i2', kind: 'joke', jokeId: b.id }] })
    await Promise.all([
      updateSetItems(s.id, items => items.map(i => (i.id === 'i1' ? { ...i, segue: 'so' } : i))),
      updateSetItems(s.id, items => items.filter(i => i.id !== 'i2')),
    ])
    expect((await db.sets.get(s.id))!.items).toEqual([{ id: 'i1', kind: 'joke', jokeId: a.id, segue: 'so' }])
  })
})
