import Dexie, { type Table } from 'dexie'
import type { ComedySet, Idea, Joke, Performance, Settings } from '../domain/types'
import { SCHEMA_V1 } from './schema'

export const DEFAULT_SETTINGS: Settings = { id: 'settings', wordsPerMinute: 150, backupReminderDays: 7 }

class BitBankDB extends Dexie {
  jokes!: Table<Joke, string>
  performances!: Table<Performance, string>
  sets!: Table<ComedySet, string>
  ideas!: Table<Idea, string>
  settings!: Table<Settings, string>

  constructor() {
    super('bitbank')
    this.version(1).stores(SCHEMA_V1)
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
