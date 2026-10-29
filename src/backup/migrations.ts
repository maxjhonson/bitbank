import { withItemKinds } from '../domain/chunks'
import { SUPPORTED_SCHEMA_VERSION } from './schema.zod'

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

// migrations[n] upgrades a version-n file to version n+1.
const migrations: Record<number, Migration> = {
  // v1 -> v2: set items gain a `kind` (all were jokes) and the file gains a chunks table.
  1: (raw) => {
    const data = { ...((raw.data as Record<string, unknown> | undefined) ?? {}) }
    if (Array.isArray(data.sets)) {
      data.sets = data.sets.map((s) =>
        s && typeof s === 'object' && Array.isArray((s as { items?: unknown }).items)
          ? { ...s, items: withItemKinds((s as { items: unknown[] }).items) }
          : s,
      )
    }
    if (data.chunks === undefined) data.chunks = []
    return { ...raw, data }
  },
}

/** Upgrades an older backup in memory. Identity for v1 and for anything that isn't a versioned object. */
export function migrateBackup(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  let cur = raw as Record<string, unknown>
  let v = cur.schemaVersion
  if (typeof v !== 'number' || !Number.isInteger(v)) return raw
  while (v < SUPPORTED_SCHEMA_VERSION) {
    const step = migrations[v]
    if (!step) return cur
    cur = { ...step(cur), schemaVersion: v + 1 }
    v += 1
  }
  return cur
}
