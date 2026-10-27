import { beforeEach, describe, expect, it } from 'vitest'
import * as repo from '../db/repo'
import { daysSince, getLastChangeAt, shouldShowBackupReminder } from './reminders'
import { wipe } from './helpers.test-util'

const now = new Date('2026-10-26T12:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const H = 3_600_000
const D = 24 * H

describe('shouldShowBackupReminder', () => {
  const base = { reminderDays: 7, now }
  it('never exported, with data -> show', () => {
    expect(shouldShowBackupReminder({ ...base, lastChangeAt: ago(D) })).toBe(true)
  })
  it('never exported, no data -> hide', () => {
    expect(shouldShowBackupReminder({ ...base })).toBe(false)
  })
  it('12 days old with changes since -> show', () => {
    expect(shouldShowBackupReminder({ ...base, lastExportAt: ago(12 * D), lastChangeAt: ago(D) })).toBe(true)
  })
  it('recent export -> hide', () => {
    expect(shouldShowBackupReminder({ ...base, lastExportAt: ago(2 * D), lastChangeAt: ago(D) })).toBe(false)
  })
  it('old export but no changes since -> hide', () => {
    expect(shouldShowBackupReminder({ ...base, lastExportAt: ago(12 * D), lastChangeAt: ago(13 * D) })).toBe(false)
  })
  it('dismissed 2h ago -> hide', () => {
    expect(
      shouldShowBackupReminder({ ...base, lastExportAt: ago(12 * D), lastChangeAt: ago(D), dismissedAt: ago(2 * H) }),
    ).toBe(false)
  })
  it('dismissed 25h ago -> show', () => {
    expect(
      shouldShowBackupReminder({ ...base, lastExportAt: ago(12 * D), lastChangeAt: ago(D), dismissedAt: ago(25 * H) }),
    ).toBe(true)
  })
})

describe('daysSince / getLastChangeAt', () => {
  beforeEach(wipe)
  it('daysSince is whole days, never negative', () => {
    expect(daysSince(ago(12 * D + H), now)).toBe(12)
    expect(daysSince(ago(-D), now)).toBe(0)
  })
  it('getLastChangeAt is the max updatedAt across tables', async () => {
    expect(await getLastChangeAt()).toBeUndefined()
    const j = await repo.createJoke()
    await new Promise((r) => setTimeout(r, 5))
    const i = await repo.addIdea('x')
    expect(await getLastChangeAt()).toBe(i.updatedAt)
    expect(i.updatedAt > j.updatedAt).toBe(true)
  })
})
