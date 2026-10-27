import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJoke, db, getJoke } from '../../db'
import { I18nProvider } from '../../i18n'
import { RehearsalTimer } from './RehearsalTimer'

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear()])
})
afterEach(() => vi.useRealTimers())

async function runTimer(jokeId: string) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<I18nProvider><RehearsalTimer jokeId={jokeId} /></I18nProvider>)
  await user.click(screen.getByRole('button', { name: 'Start timer' }))
  act(() => { vi.advanceTimersByTime(75000) })
  await user.click(screen.getByRole('button', { name: 'Stop' }))
  return user
}

describe('RehearsalTimer', () => {
  it('save as rehearsal stores a Rehearsal performance without score influence', async () => {
    const j = await createJoke()
    const user = await runTimer(j.id)
    await user.click(await screen.findByRole('button', { name: 'Save as rehearsal' }))
    await waitFor(async () => expect(await db.performances.count()).toBe(1))
    const p = (await db.performances.toArray())[0]
    expect(p).toMatchObject({ jokeId: j.id, venue: 'Rehearsal', durationSec: 75, score: 0 })
    expect(p.durationSec).toBeGreaterThanOrEqual(75)
    expect(await getJoke(j.id)).toEqual(j)
  })

  it('discard stores nothing', async () => {
    const j = await createJoke()
    const user = await runTimer(j.id)
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(await db.performances.count()).toBe(0)
  })

  it('use as manual time sets manualTimeSec and saves no performance', async () => {
    const j = await createJoke()
    const user = await runTimer(j.id)
    await user.click(await screen.findByRole('button', { name: 'Use as manual time' }))
    await waitFor(async () => expect((await getJoke(j.id))!.manualTimeSec).toBeGreaterThanOrEqual(75))
    expect(await db.performances.count()).toBe(0)
  })
})
