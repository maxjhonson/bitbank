import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { addPerformance, createJoke, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { JokeEditorPage } from './JokeEditorPage'
import { PerformanceLog } from './PerformanceLog'

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
})

const type = (el: HTMLElement, text: string) => userEvent.type(el, text, { delay: null })

function renderLog(jokeId: string) {
  return render(<I18nProvider><PerformanceLog jokeId={jokeId} /></I18nProvider>)
}

describe('PerformanceLog', () => {
  it('adds an entry with rating stored as score x2 and duration parsed', async () => {
    const j = await createJoke()
    renderLog(j.id)
    const date = await screen.findByLabelText('Date')
    await userEvent.clear(date)
    await type(date, '2026-10-01')
    await type(screen.getByLabelText('Venue'), 'Comedy Cellar')
    await type(screen.getByLabelText('Duration (m:ss)'), '1:15')
    await userEvent.selectOptions(screen.getByLabelText('Rating'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Add performance' }))
    await waitFor(async () => expect(await db.performances.count()).toBe(1))
    const p = (await db.performances.toArray())[0]
    expect(p).toMatchObject({ jokeId: j.id, date: '2026-10-01', venue: 'Comedy Cellar', durationSec: 75, score: 8 })
  })

  it('invalid duration shows inline error and does not save', async () => {
    const j = await createJoke()
    renderLog(j.id)
    await type(await screen.findByLabelText('Venue'), 'Club')
    await type(screen.getByLabelText('Duration (m:ss)'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Add performance' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/m:ss/)
    expect(await db.performances.count()).toBe(0)
  })

  it('lists newest first, shows rehearsal without score, edits and deletes', async () => {
    const j = await createJoke()
    await addPerformance({ jokeId: j.id, date: '2026-09-01', venue: 'Old Club', score: 4 })
    await addPerformance({ jokeId: j.id, date: '2026-10-05', venue: 'New Club', score: 10 })
    await addPerformance({ jokeId: j.id, date: '2026-10-03', venue: 'Rehearsal', score: 0, durationSec: 30 })
    renderLog(j.id)
    const items = await screen.findAllByRole('listitem')
    expect(items.map(i => i.textContent)).toEqual([
      expect.stringContaining('New Club'),
      expect.stringContaining('rehearsal'),
      expect.stringContaining('Old Club'),
    ])
    expect(within(items[1]).queryByText(/★|\/5/)).toBeNull()

    await userEvent.click(within(items[2]).getByRole('button', { name: 'Edit' }))
    const venue = within((await screen.findAllByRole('listitem'))[2]).getByLabelText('Venue')
    await userEvent.clear(venue)
    await type(venue, 'Renamed')
    await userEvent.click(within((await screen.findAllByRole('listitem'))[2]).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await db.performances.where('date').equals('2026-09-01').first())?.venue).toBe('Renamed'))

    await userEvent.click(within((await screen.findAllByRole('listitem'))[0]).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await db.performances.count()).toBe(2))
  })
})

describe('PerformanceLog edge cases', () => {
  it('clearing duration on edit removes durationSec from the DB', async () => {
    const j = await createJoke()
    await addPerformance({ jokeId: j.id, date: '2026-09-01', venue: 'Club', score: 4, durationSec: 90 })
    renderLog(j.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const li = (await screen.findAllByRole('listitem'))[0]
    await userEvent.clear(within(li).getByLabelText('Duration (m:ss)'))
    await userEvent.click(within(li).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect('durationSec' in ((await db.performances.toArray())[0] as object)).toBe(false))
  })

  it('venue with surrounding spaces still counts as rehearsal (no rating field, score 0)', async () => {
    const j = await createJoke()
    renderLog(j.id)
    await type(await screen.findByLabelText('Venue'), ' Rehearsal ')
    expect(screen.queryByLabelText('Rating')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Add performance' }))
    await waitFor(async () => expect(await db.performances.count()).toBe(1))
    expect((await db.performances.toArray())[0]).toMatchObject({ venue: 'Rehearsal', score: 0 })
  })
})

describe('SidePanel derived values', () => {
  it('after a real performance shows measured source and average score', async () => {
    const j = await createJoke()
    await addPerformance({ jokeId: j.id, date: '2026-10-01', venue: 'Club', score: 8, durationSec: 60 })
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[`/jokes/${j.id}`]}>
          <Routes><Route path="/jokes/:id" element={<JokeEditorPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(await screen.findByText('Measured')).toBeInTheDocument()
    expect(screen.getByText('8.0')).toBeInTheDocument()
  })
})

describe('PerformanceLog validation', () => {
  it('blocks an empty/invalid date on add with an alert and saves nothing', async () => {
    const j = await createJoke()
    renderLog(j.id)
    const date = await screen.findByLabelText('Date')
    await userEvent.clear(date)
    await type(screen.getByLabelText('Venue'), 'Club')
    await userEvent.click(screen.getByRole('button', { name: 'Add performance' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid date/)
    expect(await db.performances.count()).toBe(0)
  })

  it('blocks an empty venue on add', async () => {
    const j = await createJoke()
    renderLog(j.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Add performance' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/venue/i)
    expect(await db.performances.count()).toBe(0)
  })

  it('blocks clearing the date on edit', async () => {
    const j = await createJoke()
    await addPerformance({ jokeId: j.id, date: '2026-10-01', venue: 'Club', score: 6 })
    renderLog(j.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dates = screen.getAllByLabelText('Date')
    await userEvent.clear(dates[dates.length - 1])
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent(/valid date/)
    expect((await db.performances.toArray())[0].date).toBe('2026-10-01')
  })
})
