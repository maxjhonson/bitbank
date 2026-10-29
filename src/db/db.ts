import Dexie, { type Table, type Transaction } from 'dexie'
import { withItemKinds } from '../domain/chunks'
import type { Chunk, ComedySet, Idea, Joke, Performance, Settings } from '../domain/types'
import { SCHEMA_V1, SCHEMA_V2 } from './schema'

export const DEFAULT_SETTINGS: Settings = { id: 'settings', wordsPerMinute: 150, backupReminderDays: 7 }

/** Dexie v1 -> v2: legacy set items get `kind: 'joke'`. */
export function upgradeToV2(tx: Transaction): PromiseLike<unknown> {
  return tx
    .table('sets')
    .toCollection()
    .modify((set: { items?: unknown[] }) => {
      set.items = withItemKinds(set.items ?? [])
    })
}

class BitBankDB extends Dexie {
  jokes!: Table<Joke, string>
  performances!: Table<Performance, string>
  sets!: Table<ComedySet, string>
  ideas!: Table<Idea, string>
  settings!: Table<Settings, string>
  chunks!: Table<Chunk, string>

  constructor() {
    super('bitbank')
    this.version(1).stores(SCHEMA_V1)
    this.version(2).stores(SCHEMA_V2).upgrade(upgradeToV2)
  }
}

export const db = new BitBankDB()

export async function getSettings(): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('settings')
    if (existing) return existing
    const created = { ...DEFAULT_SETTINGS }
    await db.settings.put(created)
    return created
  })
}
