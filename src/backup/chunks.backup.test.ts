import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import * as repo from '../db/repo'
import { buildBackup, exportMarkdown } from './export'
import { applyImport, parseBackup, previewImport } from './import'
import { snapshot, wipe } from './helpers.test-util'

beforeEach(wipe)

const TS = '2026-10-01T00:00:00.000Z'
const joke = (id: string) => ({
  id, title: `J ${id}`, premise: '', setup: 's', punchline: 'p', tagLines: [], notes: '',
  status: 'draft', tags: [], versions: [], createdAt: TS, updatedAt: TS,
})
function v1(items: unknown[], extraData: Record<string, unknown> = {}, schemaVersion = 1) {
  return JSON.stringify({
    app: 'bitbank', schemaVersion, exportedAt: TS,
    data: {
      jokes: [joke('a')], performances: [], ideas: [],
      sets: [{ id: 's1', name: 'S', targetSec: 600, bufferSec: 60, items, createdAt: TS, updatedAt: TS }],
      settings: { id: 'settings', wordsPerMinute: 150, backupReminderDays: 7 },
      ...extraData,
    },
  })
}
function parsed(text: string) {
  const p = parseBackup(text)
  if (!p.ok) throw new Error(p.errors.join())
  return p.file
}

describe('chunks backup', () => {
  it('a v1 file with typeless set items and no chunks parses and imports', async () => {
    const file = parsed(v1([{ id: 'i1', jokeId: 'a' }]))
    expect(file.data.chunks).toEqual([])
    await applyImport(file, 'replace')
    const s = await db.sets.get('s1')
    expect(s?.items).toEqual([{ id: 'i1', kind: 'joke', jokeId: 'a' }])
  })

  it('a v1 file whose set item points to a missing joke imports and the item is removed (removedDangling 1)', async () => {
    const file = parsed(v1([{ id: 'i1', jokeId: 'a' }, { id: 'i2', jokeId: 'zzz' }]))
    const r = await applyImport(file, 'replace')
    expect(r.removedDangling).toBe(1)
    expect((await db.sets.get('s1'))?.items.map((i) => i.id)).toEqual(['i1'])
  })

  it('export then replace-import round-trips a chunk and a chunk set item with skips', async () => {
    const a = await repo.createJoke({ title: 'A' })
    const b = await repo.createJoke({ title: 'B' })
    const c = await repo.createChunk({ title: 'C', items: [{ jokeId: a.id }, { jokeId: b.id, segue: 'so' }] })
    const s = await repo.createSet({ name: 'Set' })
    await repo.updateSet(s.id, {
      items: [{ id: 'ci', kind: 'chunk', chunkId: c.id, skippedJokeIds: [b.id], role: 'opener' }],
    })
    await repo.updateSettings({ wordsPerMinute: 150 })
    const text = JSON.stringify(await buildBackup())
    const before = await snapshot()
    await wipe()
    const r = await applyImport(parsed(text), 'replace')
    expect(r.removedDangling).toBe(0)
    expect(await snapshot()).toEqual(before)
    expect((await db.chunks.toArray()).length).toBe(1)
  })

  it('merge import: chunk newer/older/new classification works and preview.chunks counts are right', async () => {
    const mk = (id: string, updatedAt: string) => ({ id, title: id, items: [{ jokeId: 'a' }], notes: '', createdAt: TS, updatedAt })
    await db.jokes.add(joke('a') as never)
    await db.chunks.bulkAdd([mk('c-newer', TS), mk('c-older', '2026-10-05T00:00:00.000Z'), mk('c-same', TS)])
    const file = parsed(
      v1([], { chunks: [mk('c-newer', '2026-10-03T00:00:00.000Z'), mk('c-older', TS), mk('c-same', TS), mk('c-new', TS)] }, 2),
    )
    const pv = await previewImport(file)
    expect(pv.chunks).toEqual({ inFile: 4, new: 1, newer: 1, older: 1, identical: 1 })
    const r = await applyImport(file, 'merge')
    expect(r.added).toBeGreaterThanOrEqual(1)
    expect((await db.chunks.get('c-newer'))?.updatedAt).toBe('2026-10-03T00:00:00.000Z')
    expect((await db.chunks.get('c-older'))?.updatedAt).toBe('2026-10-05T00:00:00.000Z')
    expect(await db.chunks.get('c-new')).toBeTruthy()
  })

  it('import removes dangling chunk items and chunk entries, counting both; does not fail', async () => {
    const chunk = {
      id: 'c1', title: 'C', items: [{ jokeId: 'a' }, { jokeId: 'gone' }], notes: '', createdAt: TS, updatedAt: TS,
    }
    const file = parsed(
      v1(
        [
          { id: 'i1', kind: 'chunk', chunkId: 'c1' },
          { id: 'i2', kind: 'chunk', chunkId: 'missing' },
        ],
        { chunks: [chunk] },
        2,
      ),
    )
    const r = await applyImport(file, 'replace')
    expect(r.removedDangling).toBe(2)
    expect((await db.sets.get('s1'))?.items.map((i) => i.id)).toEqual(['i1'])
    expect((await db.chunks.get('c1'))?.items).toEqual([{ jokeId: 'a' }])
  })

  it('markdown export lists a chunk item with its ticked jokes under the set', async () => {
    const a = await repo.createJoke({ title: 'Alpha' })
    const b = await repo.createJoke({ title: 'Beta' })
    const c = await repo.createChunk({ title: 'Combo', items: [{ jokeId: a.id }, { jokeId: b.id }] })
    const s = await repo.createSet({ name: 'Night' })
    await repo.updateSet(s.id, { items: [{ id: 'ci', kind: 'chunk', chunkId: c.id, skippedJokeIds: [b.id] }] })
    const md = await exportMarkdown()
    expect(md).toContain('1. Combo\n   - Alpha')
    expect(md).not.toMatch(/- Beta/)
  })

  it('a v1 file with a null set item returns a parse error instead of throwing', () => {
    const p = parseBackup(v1([null]))
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.errors.length).toBeGreaterThan(0)
  })

  it('markdown export lists ticked jokes with their spoken segues, then the chunk own segue last', async () => {
    const [a, b, c2, d] = await Promise.all(['Alpha', 'Beta', 'Gamma', 'Delta'].map((t) => repo.createJoke({ title: t })))
    const c = await repo.createChunk({
      title: 'Combo',
      items: [{ jokeId: a.id, segue: 'so' }, { jokeId: b.id, segue: 'skipped-one' }, { jokeId: c2.id, segue: 'lastseg' }, { jokeId: d.id }],
    })
    const s = await repo.createSet({ name: 'Night' })
    await repo.updateSet(s.id, {
      items: [{ id: 'ci', kind: 'chunk', chunkId: c.id, skippedJokeIds: [b.id, d.id], role: 'closer', segue: 'outer' }],
    })
    const md = await exportMarkdown()
    expect(md).toContain(['1. Combo [closer]', '   - Alpha', '     - Segue: so', '   - Gamma', '   - Segue: outer'].join('\n'))
    expect(md).not.toMatch(/skipped-one|lastseg/)
  })

  it('a v2 file with schemaVersion 3 is still rejected as newer', () => {
    const p = parseBackup(v1([], { chunks: [] }, 3))
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.errors[0]).toMatch(/newer version/)
  })
})
