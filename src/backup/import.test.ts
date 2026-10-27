import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import * as repo from '../db/repo'
import { buildBackup, exportJson } from './export'
import { applyImport, parseBackup, previewImport } from './import'
import type { BackupFile } from './schema.zod'
import { seed, snapshot, wipe } from './helpers.test-util'

beforeEach(async () => {
  vi.restoreAllMocks()
  await wipe()
})

async function fileOf(): Promise<BackupFile> {
  const p = parseBackup(JSON.stringify(await buildBackup()))
  if (!p.ok) throw new Error(p.errors.join())
  return p.file
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

describe('round trip', () => {
  it('seed -> export -> wipe -> import(replace) deep-equals original', async () => {
    await seed()
    const { json } = await exportJson()
    const original = await snapshot() // includes lastExportAt written by export
    await wipe()
    const p = parseBackup(json)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    await applyImport(p.file, 'replace')
    expect(await snapshot()).toEqual(original)
  })
})

describe('rejection', () => {
  const cases: [string, string][] = [
    ['empty string', ''],
    ['whitespace', '   \n'],
    ['not json', 'not json'],
    ['array', '[]'],
    ['null', 'null'],
    ['wrong app', JSON.stringify({ app: 'other', schemaVersion: 1 })],
    ['newer schema', JSON.stringify({ app: 'bitbank', schemaVersion: 99 })],
    ['missing data', JSON.stringify({ app: 'bitbank', schemaVersion: 1, exportedAt: '2026-01-01T00:00:00.000Z' })],
  ]
  for (const [name, text] of cases) {
    it(`${name} -> ok:false, DB untouched`, async () => {
      await seed()
      const before = await snapshot()
      const r = parseBackup(text)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
      expect(await snapshot()).toEqual(before)
    })
  }

  it('newer schema message is clear', () => {
    const r = parseBackup(JSON.stringify({ app: 'bitbank', schemaVersion: 99 }))
    expect(!r.ok && r.errors[0]).toMatch(/newer version/)
  })

  it('malformed record (score 11) reports table[index]', async () => {
    await seed()
    const bad = clone(await fileOf())
    bad.data.performances[1].score = 11
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/^performances\[1\]: score:/)
  })

  it('reports at most 5 errors', async () => {
    await seed()
    const bad = clone(await fileOf()) as unknown as { data: { jokes: unknown[] } }
    bad.data.jokes = Array.from({ length: 9 }, () => ({}))
    const r = parseBackup(JSON.stringify(bad))
    expect(!r.ok && r.errors.length).toBe(5)
  })

  it('bad date format rejected', async () => {
    await seed()
    const bad = clone(await fileOf())
    bad.data.performances[0].date = '10/01/2026'
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })
})

describe('lenient parsing', () => {
  it('strips unknown extra fields', async () => {
    await seed()
    const f = clone(await fileOf()) as any
    f.data.jokes[0].surprise = 'x'
    f.data.settings.weird = 1
    f.extra = true
    const r = parseBackup(JSON.stringify(f))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect('surprise' in r.file.data.jokes[0]).toBe(false)
    expect('weird' in r.file.data.settings).toBe(false)
    await applyImport(r.file, 'replace')
    expect('surprise' in (await db.jokes.toArray())[0]).toBe(false)
  })

  it('duplicate ids in file: later wins, no throw', async () => {
    const j = await repo.createJoke({ title: 'first' })
    const f = clone(await fileOf())
    f.data.jokes.push({ ...f.data.jokes[0], title: 'second' })
    const r = parseBackup(JSON.stringify(f))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.data.jokes).toHaveLength(1)
    expect((await previewImport(r.file)).jokes.inFile).toBe(1)
    await db.jokes.clear()
    await applyImport(r.file, 'merge')
    expect((await db.jokes.get(j.id))?.title).toBe('second')
  })

  it('missing optional counts is fine', async () => {
    const f = clone(await fileOf()) as any
    delete f.counts
    expect(parseBackup(JSON.stringify(f)).ok).toBe(true)
  })
})

describe('merge', () => {
  it('keeps newer local, takes newer file, adds new, deletes nothing, keeps local settings', async () => {
    const keepLocal = await repo.createJoke({ title: 'local-new' })
    const takeFile = await repo.createJoke({ title: 'file-new' })
    const localOnly = await repo.createJoke({ title: 'local-only' })
    const tie = await repo.createJoke({ title: 'tie-local' })
    await repo.updateSettings({ wordsPerMinute: 111 })
    const file = await fileOf()
    const find = (id: string) => file.data.jokes.find((j) => j.id === id)!
    find(keepLocal.id).updatedAt = '2000-01-01T00:00:00.000Z'
    find(keepLocal.id).title = 'file-old'
    find(takeFile.id).updatedAt = '2999-01-01T00:00:00.000Z'
    find(takeFile.id).title = 'file-newer'
    find(tie.id).title = 'tie-file'
    const added = { ...find(tie.id), id: 'brand-new', title: 'added' }
    file.data.jokes = file.data.jokes.filter((j) => j.id !== localOnly.id)
    file.data.jokes.push(added)
    file.data.settings.wordsPerMinute = 222

    expect((await previewImport(file)).jokes).toEqual({ inFile: 4, new: 1, newer: 1, older: 1, identical: 1 })

    const res = await applyImport(file, 'merge')
    expect(res).toMatchObject({ added: 1, updated: 1, skipped: 2, removedDangling: 0 })
    const title = async (id: string) => (await db.jokes.get(id))?.title
    expect(await title(keepLocal.id)).toBe('local-new')
    expect(await title(takeFile.id)).toBe('file-newer')
    expect(await title(tie.id)).toBe('tie-local')
    expect(await title(localOnly.id)).toBe('local-only')
    expect(await title('brand-new')).toBe('added')
    expect((await db.settings.get('settings'))?.wordsPerMinute).toBe(111)
  })
})

describe('atomicity and references', () => {
  it('failing write mid-transaction leaves DB unchanged (replace and merge)', async () => {
    await seed()
    const file = await fileOf()
    file.data.jokes = file.data.jokes.map((j) => ({ ...j, title: 'CHANGED', updatedAt: '2999-01-01T00:00:00.000Z' }))
    file.data.sets = file.data.sets.map((x) => ({ ...x, name: 'CHANGED', updatedAt: '2999-01-01T00:00:00.000Z' }))
    const before = await snapshot()
    for (const mode of ['replace', 'merge'] as const) {
      // Transaction-bound tables inherit from the Table prototype, so patch it and fail only for sets.
      let proto = Object.getPrototypeOf(db.table('sets'))
      while (!Object.prototype.hasOwnProperty.call(proto, 'bulkPut')) proto = Object.getPrototypeOf(proto)
      const orig = proto.bulkPut
      const spy = vi.spyOn(proto, 'bulkPut').mockImplementation(function (this: { name: string }, ...args: unknown[]) {
        if (this.name === 'sets') return Promise.reject(new Error('boom'))
        return orig.apply(this, args)
      })
      await expect(applyImport(file, mode)).rejects.toThrow()
      spy.mockRestore()
      expect(await snapshot()).toEqual(before)
    }
  })

  it('removes dangling performances and set items, and counts them', async () => {
    await seed()
    const file = await fileOf()
    const gone = file.data.jokes[0].id
    file.data.jokes = file.data.jokes.filter((j) => j.id !== gone)
    const res = await applyImport(file, 'replace')
    expect(res.removedDangling).toBe(2) // one performance + one set item
    expect(await db.performances.count()).toBe(1)
    expect((await db.sets.toArray())[0].items).toHaveLength(1)
  })
})
