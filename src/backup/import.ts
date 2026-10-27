import { db, normalizeTags } from '../db'
import type { ComedySet, Idea, Joke, Performance } from '../domain/types'
import { migrateBackup } from './migrations'
import { backupFileSchema, SUPPORTED_SCHEMA_VERSION, type BackupFile } from './schema.zod'

type TableName = 'jokes' | 'performances' | 'sets' | 'ideas'
const TABLES: TableName[] = ['jokes', 'performances', 'sets', 'ideas']

export type TableCounts = { inFile: number; new: number; newer: number; older: number; identical: number }
export type ImportPreview = Record<TableName, TableCounts>
export type ImportResult = { added: number; updated: number; skipped: number; removedDangling: number }
export type ParseResult = { ok: true; file: BackupFile } | { ok: false; errors: string[] }

const fail = (...errors: string[]): ParseResult => ({ ok: false, errors })

function dedupe<T extends { id: string }>(records: T[]): T[] {
  const m = new Map<string, T>()
  for (const r of records) m.set(r.id, r) // later entry wins
  return [...m.values()]
}

export function parseBackup(text: string): ParseResult {
  if (text.trim() === '') return fail('The file is empty.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('The file is not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail('This is not a Bit Bank backup (expected a JSON object).')
  }
  const head = raw as Record<string, unknown>
  if (head.app !== 'bitbank') return fail('This is not a Bit Bank backup (wrong "app" value).')
  if (typeof head.schemaVersion !== 'number' || !Number.isInteger(head.schemaVersion)) {
    return fail('The backup has no valid schemaVersion.')
  }
  if (head.schemaVersion < 1) {
    return fail(`The backup has an invalid schemaVersion (${head.schemaVersion}); it must be 1 or higher.`)
  }
  if (head.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    return fail(
      `This backup was made by a newer version of Bit Bank (schema ${head.schemaVersion}; this app supports up to ${SUPPORTED_SCHEMA_VERSION}). Update the app and try again.`,
    )
  }
  const result = backupFileSchema.safeParse(migrateBackup(raw))
  if (!result.success) {
    const errors = result.error.issues.slice(0, 5).map((issue) => {
      const path = issue.path
      if (path[0] === 'data' && typeof path[1] === 'string' && typeof path[2] === 'number') {
        const rest = path.slice(3).join('.')
        return `${path[1]}[${path[2]}]: ${rest ? `${rest}: ` : ''}${issue.message}`
      }
      const where = path.filter((p) => p !== 'data').join('.')
      return where ? `${where}: ${issue.message}` : issue.message
    })
    return fail(...errors)
  }
  return { ok: true, file: dedupeFile(result.data) }
}

function dedupeFile(file: BackupFile): BackupFile {
  return {
    ...file,
    data: {
      ...file.data,
      jokes: dedupe(file.data.jokes),
      performances: dedupe(file.data.performances),
      sets: dedupe(file.data.sets),
      ideas: dedupe(file.data.ideas),
    },
  }
}

type Rec = Joke | Performance | ComedySet | Idea
type Kind = 'new' | 'newer' | 'older' | 'identical'

function classify(file: Rec, local: Rec | undefined): Kind {
  if (!local) return 'new'
  const f = Date.parse(file.updatedAt)
  const l = Date.parse(local.updatedAt)
  if (f > l) return 'newer'
  if (f < l) return 'older'
  return 'identical' // same timestamp: local is kept either way
}

async function localById(t: TableName, records: Rec[]): Promise<Map<string, Rec>> {
  const found = (await db.table(t).bulkGet(records.map((r) => r.id))) as (Rec | undefined)[]
  const m = new Map<string, Rec>()
  for (const r of found) if (r) m.set(r.id, r)
  return m
}

export async function previewImport(file: BackupFile): Promise<ImportPreview> {
  const f = dedupeFile(file)
  const preview = {} as ImportPreview
  for (const t of TABLES) {
    const records = f.data[t] as Rec[]
    const local = await localById(t, records)
    const c: TableCounts = { inFile: records.length, new: 0, newer: 0, older: 0, identical: 0 }
    for (const r of records) c[classify(r, local.get(r.id))]++
    preview[t] = c
  }
  return preview
}

export async function applyImport(file: BackupFile, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const deduped = dedupeFile(file).data
  const data = { ...deduped, jokes: deduped.jokes.map((j) => ({ ...j, tags: normalizeTags(j.tags) })) }
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, removedDangling: 0 }

  await db.transaction('rw', [db.jokes, db.performances, db.sets, db.ideas, db.settings], async () => {
    // Reset counters in case Dexie retries the transaction callback.
    result.added = result.updated = result.skipped = result.removedDangling = 0
    if (mode === 'replace') {
      await Promise.all([db.jokes, db.performances, db.sets, db.ideas, db.settings].map((t) => t.clear()))
      await db.jokes.bulkPut(data.jokes)
      await db.performances.bulkPut(data.performances)
      await db.sets.bulkPut(data.sets)
      await db.ideas.bulkPut(data.ideas)
      await db.settings.put(data.settings)
      result.added = data.jokes.length + data.performances.length + data.sets.length + data.ideas.length
    } else {
      for (const t of TABLES) {
        const records = data[t] as Rec[]
        const local = await localById(t, records)
        const toWrite: Rec[] = []
        for (const r of records) {
          const c = classify(r, local.get(r.id))
          if (c === 'new') {
            result.added++
            toWrite.push(r)
          } else if (c === 'newer') {
            result.updated++
            toWrite.push(r)
          } else result.skipped++
        }
        if (toWrite.length) await db.table(t).bulkPut(toWrite)
      }
    }

    // Reference check, inside the same transaction.
    const jokeIds = new Set((await db.jokes.toCollection().primaryKeys()) as string[])
    const danglingPerfs = (await db.performances.toArray()).filter((p) => !jokeIds.has(p.jokeId))
    if (danglingPerfs.length) {
      await db.performances.bulkDelete(danglingPerfs.map((p) => p.id))
      result.removedDangling += danglingPerfs.length
    }
    for (const s of await db.sets.toArray()) {
      const kept = s.items.filter((i) => jokeIds.has(i.jokeId))
      if (kept.length !== s.items.length) {
        result.removedDangling += s.items.length - kept.length
        await db.sets.put({ ...s, items: kept })
      }
    }
  })
  return result
}
