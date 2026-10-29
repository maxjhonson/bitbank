import { db } from '../db'

const DAY_MS = 86_400_000

/** Whole days elapsed since `iso` (never negative). */
export function daysSince(iso: string, now: Date): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS))
}

export function shouldShowBackupReminder(a: {
  lastExportAt?: string
  lastChangeAt?: string
  reminderDays: number
  dismissedAt?: string
  now: Date
}): boolean {
  if (a.dismissedAt && a.now.getTime() - Date.parse(a.dismissedAt) < DAY_MS) return false
  if (!a.lastChangeAt) return false // nothing to protect
  if (!a.lastExportAt) return true // never exported, but there is data
  const stale = daysSince(a.lastExportAt, a.now) >= a.reminderDays
  const changed = Date.parse(a.lastChangeAt) > Date.parse(a.lastExportAt)
  return stale && changed
}

/** Max updatedAt across jokes, performances, sets, ideas and chunks. */
export async function getLastChangeAt(): Promise<string | undefined> {
  let max: string | undefined
  for (const t of [db.jokes, db.performances, db.sets, db.ideas, db.chunks]) {
    for (const r of (await t.toArray()) as { updatedAt: string }[]) {
      if (!max || Date.parse(r.updatedAt) > Date.parse(max)) max = r.updatedAt
    }
  }
  return max
}
