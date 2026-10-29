import { z } from 'zod'

export const SUPPORTED_SCHEMA_VERSION = 1

const isoTimestamp = z.iso.datetime({ offset: true, message: 'must be an ISO timestamp' })
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, 'must be a real calendar date')
const score = z.number().min(0).max(10)
const id = z.string().min(1)

// Plain z.object strips unknown fields (never rejects them).
export const jokeSchema = z.object({
  id,
  title: z.string(),
  premise: z.string(),
  setup: z.string(),
  punchline: z.string(),
  tagLines: z.array(z.object({ id: z.string(), text: z.string(), kind: z.enum(['tag', 'act-out']) })),
  notes: z.string(),
  status: z.enum(['draft', 'working', 'tight', 'retired']),
  tags: z.array(z.string()),
  manualTimeSec: z.number().min(0).optional(),
  manualScore: score.optional(),
  versions: z.array(z.object({ savedAt: z.string(), setup: z.string(), punchline: z.string() })),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

export const performanceSchema = z.object({
  id,
  jokeId: id,
  date: dateOnly,
  venue: z.string(),
  durationSec: z.number().min(0).optional(),
  score,
  note: z.string().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

export const setSchema = z.object({
  id,
  name: z.string(),
  date: dateOnly.optional(),
  venue: z.string().optional(),
  targetSec: z.number().min(0),
  bufferSec: z.number().min(0),
  items: z.array(
    z
      .object({
        id,
        kind: z.literal('joke').optional(),
        jokeId: id,
        role: z.enum(['opener', 'closer']).optional(),
        segue: z.string().optional(),
      })
      .transform(i => ({ ...i, kind: 'joke' as const })),
  ),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

export const ideaSchema = z.object({
  id,
  text: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  promotedJokeId: z.string().optional(),
})

export const settingsSchema = z.object({
  id: z.literal('settings').default('settings'),
  wordsPerMinute: z.number().positive().default(150),
  lastExportAt: isoTimestamp.optional(),
  backupReminderDays: z.number().min(0).default(7),
})

const counts = z.object({
  jokes: z.number().int(),
  performances: z.number().int(),
  sets: z.number().int(),
  ideas: z.number().int(),
})

export const backupFileSchema = z.object({
  app: z.literal('bitbank'),
  schemaVersion: z.number().int(),
  exportedAt: isoTimestamp,
  counts: counts.optional(), // informational only; never trusted
  data: z.object({
    jokes: z.array(jokeSchema),
    performances: z.array(performanceSchema),
    sets: z.array(setSchema),
    ideas: z.array(ideaSchema),
    settings: settingsSchema,
  }),
})

export type BackupFile = z.infer<typeof backupFileSchema>
export type BackupCounts = z.infer<typeof counts>
