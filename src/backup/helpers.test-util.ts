import { db } from '../db'
import * as repo from '../db/repo'

export async function wipe() {
  await Promise.all(db.tables.map((t) => t.clear()))
}

export async function seed() {
  const a = await repo.createJoke({
    title: 'Airports',
    setup: 'one two three four five six',
    punchline: 'boom',
    tags: ['travel'],
  })
  const b = await repo.createJoke({
    title: 'Dad',
    premise: 'my dad',
    manualTimeSec: 45,
    tagLines: [{ id: 't1', text: 'tag', kind: 'tag' }],
  })
  await repo.addPerformance({ jokeId: a.id, date: '2026-10-01', venue: 'Cellar', score: 7, durationSec: 30, note: 'ok' })
  await repo.addPerformance({ jokeId: b.id, date: '2026-10-02', venue: 'Cellar', score: 5 })
  const s = await repo.createSet({ name: 'Friday', date: '2026-10-30' })
  await repo.updateSet(s.id, {
    items: [
      { id: 'i1', jokeId: b.id, role: 'opener' },
      { id: 'i2', jokeId: a.id, segue: 'so' },
    ],
  })
  await repo.addIdea('an idea')
  await repo.updateSettings({ wordsPerMinute: 160 })
  return { a, b, s }
}

export async function snapshot() {
  return Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()] as const))
}
