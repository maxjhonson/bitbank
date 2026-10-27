import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { backupFilename, buildBackup, exportJson, exportMarkdown } from './export'
import { backupFileSchema } from './schema.zod'
import { seed, wipe } from './helpers.test-util'

beforeEach(wipe)

describe('export', () => {
  it('filename uses local date and time', () => {
    expect(backupFilename(new Date(2026, 9, 26, 21, 30))).toBe('bitbank-backup-2026-10-26-2130.json')
  })

  it('exportJson is valid, indented, counted, and sets lastExportAt', async () => {
    await seed()
    const now = new Date(2026, 9, 26, 21, 30)
    const out = await exportJson(now)
    expect(out.filename).toBe('bitbank-backup-2026-10-26-2130.json')
    expect(out.counts).toEqual({ jokes: 2, performances: 2, sets: 1, ideas: 1 })
    expect(out.json).toContain('\n  "app": "bitbank"')
    expect(backupFileSchema.safeParse(JSON.parse(out.json)).success).toBe(true)
    expect((await db.settings.get('settings'))?.lastExportAt).toBe(now.toISOString())
  })

  it('buildBackup does not write', async () => {
    await buildBackup()
    expect(await db.settings.count()).toBe(0)
  })

  it('markdown has joke fields and numbered set order', async () => {
    await seed()
    const md = await exportMarkdown()
    expect(md).toContain('### Airports')
    expect(md).toContain('**Punchline:** boom')
    expect(md).toContain('**Tags:** #travel')
    expect(md).toContain('**Time:** 0:30 (measured)')
    expect(md).toContain('**Time:** 0:45 (manual)')
    expect(md).toContain('**Score:** 7')
    expect(md).toContain('- tag')
    expect(md).toContain('1. Dad [opener]')
    expect(md).toContain('2. Airports')
    expect(md.indexOf('1. Dad')).toBeLessThan(md.indexOf('2. Airports'))
  })
})
