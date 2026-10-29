import { isChunkItem } from '../domain/chunks'
import { db, updateSettings } from '../db'
import { jokeScore, jokeTime } from '../domain/derive'
import { formatMmSs } from '../domain/time'
import type { Performance, Settings } from '../domain/types'
import { SUPPORTED_SCHEMA_VERSION, backupFileSchema, type BackupCounts, type BackupFile } from './schema.zod'

export function backupFilename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `bitbank-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`
}

async function readSettings(): Promise<Settings> {
  const s = await db.settings.get('settings')
  return s ?? { id: 'settings', wordsPerMinute: 150, backupReminderDays: 7 }
}

export async function buildBackup(now: Date = new Date()): Promise<BackupFile> {
  // One read transaction so the snapshot is consistent.
  const [jokes, performances, sets, ideas, chunks, settings] = await db.transaction(
    'r',
    [db.jokes, db.performances, db.sets, db.ideas, db.chunks, db.settings],
    async () =>
      [
        await db.jokes.toArray(),
        await db.performances.toArray(),
        await db.sets.toArray(),
        await db.ideas.toArray(),
        await db.chunks.toArray(),
        await readSettings(),
      ] as const,
  )
  return {
    app: 'bitbank',
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: { jokes: jokes.length, performances: performances.length, sets: sets.length, ideas: ideas.length, chunks: chunks.length },
    data: { jokes, performances, sets, ideas, chunks, settings },
  }
}

/** Builds the backup JSON and records Settings.lastExportAt. The caller must then trigger the download. */
export async function exportJson(
  now: Date = new Date(),
): Promise<{ filename: string; json: string; counts: BackupCounts }> {
  const file = await buildBackup(now)
  // The file records its own export time so a restored backup does not look un-backed-up.
  file.data.settings = { ...file.data.settings, lastExportAt: file.exportedAt }
  const json = JSON.stringify(file, null, 2)
  const check = backupFileSchema.safeParse(JSON.parse(json))
  if (!check.success) {
    const issue = check.error.issues[0]
    throw new Error(`Backup failed validation (${issue.path.join('.')}: ${issue.message}). Nothing was exported.`)
  }
  await updateSettings({ lastExportAt: file.exportedAt })
  return { filename: backupFilename(now), json, counts: file.counts as BackupCounts }
}

export async function exportMarkdown(): Promise<string> {
  const [jokes, performances, sets, chunks, settings] = await db.transaction(
    'r',
    [db.jokes, db.performances, db.sets, db.chunks, db.settings],
    async () => [
      await db.jokes.toArray(),
      await db.performances.toArray(),
      await db.sets.toArray(),
      await db.chunks.toArray(),
      await readSettings(),
    ] as const,
  )
  const chunkById = new Map(chunks.map((c) => [c.id, c]))
  const perfsByJoke = new Map<string, Performance[]>()
  for (const p of performances) {
    const list = perfsByJoke.get(p.jokeId) ?? []
    list.push(p)
    perfsByJoke.set(p.jokeId, list)
  }
  const jokeById = new Map(jokes.map((j) => [j.id, j]))
  const titleOf = (j: { title: string }) => j.title.trim() || 'Untitled joke'
  const out: string[] = ['# Bit Bank', '', '## Jokes', '']

  const sorted = [...jokes].sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
  if (sorted.length === 0) out.push('_No jokes._', '')
  for (const j of sorted) {
    const perfs = perfsByJoke.get(j.id) ?? []
    const t = jokeTime(j, perfs, settings.wordsPerMinute)
    const score = jokeScore(j, perfs)
    out.push(`### ${titleOf(j)}`, '')
    if (j.premise) out.push(`**Premise:** ${j.premise}`, '')
    if (j.setup) out.push(`**Setup:** ${j.setup}`, '')
    if (j.punchline) out.push(`**Punchline:** ${j.punchline}`, '')
    if (j.tagLines.length) {
      out.push('**Tag lines:**')
      for (const tl of j.tagLines) out.push(`- ${tl.kind === 'act-out' ? '(act-out) ' : ''}${tl.text}`)
      out.push('')
    }
    if (j.tags.length) out.push(`**Tags:** ${j.tags.map((x) => `#${x}`).join(' ')}`, '')
    out.push(`**Status:** ${j.status}`, '')
    out.push(`**Time:** ${formatMmSs(t.sec)} (${t.source})`, '')
    out.push(`**Score:** ${score === null ? 'untested' : score}`, '')
  }

  out.push('## Sets', '')
  if (sets.length === 0) out.push('_No sets._', '')
  for (const s of sets) {
    out.push(`### ${s.name.trim() || 'Untitled set'}`, '')
    const meta = [s.date, s.venue, `target ${formatMmSs(s.targetSec)}`].filter(Boolean)
    out.push(meta.join(' · '), '')
    let n = 0
    for (const item of s.items) {
      if (isChunkItem(item)) {
        const c = chunkById.get(item.chunkId)
        if (!c) continue
        n += 1
        const role = item.role ? ` [${item.role}]` : ''
        out.push(`${n}. ${c.title.trim() || 'Untitled chunk'}${role}`)
        if (item.segue) out.push(`   - Segue: ${item.segue}`)
        const skip = new Set(item.skippedJokeIds ?? [])
        for (const ci of c.items) {
          const cj = jokeById.get(ci.jokeId)
          if (cj && !skip.has(ci.jokeId)) out.push(`   - ${titleOf(cj)}`)
        }
        continue
      }
      const j = jokeById.get(item.jokeId)
      if (!j) continue
      n += 1
      const role = item.role ? ` [${item.role}]` : ''
      out.push(`${n}. ${titleOf(j)}${role}`)
      if (item.segue) out.push(`   - Segue: ${item.segue}`)
    }
    out.push('')
  }
  return out.join('\n')
}
