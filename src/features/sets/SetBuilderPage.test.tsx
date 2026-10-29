import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPerformance, createJoke, createSet, db, updateJoke } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { SetBuilderPage } from './SetBuilderPage'

function renderPage(id: string) {
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[`/sets/${id}`]}>
        <Routes><Route path="/sets/:id" element={<SetBuilderPage />} /></Routes>
      </MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}

async function seed(secs: number[], o: Parameters<typeof createSet>[0] = {}) {
  const jokes = []
  for (let i = 0; i < secs.length; i++) jokes.push(await createJoke({ title: `J${i + 1}`, manualTimeSec: secs[i] }))
  const set = await createSet({
    name: 'Show', targetSec: 900, bufferSec: 60,
    items: jokes.map((j, i) => ({ id: `it${i + 1}`, kind: 'joke', jokeId: j.id })), ...o,
  })
  return { jokes, set }
}

const titles = () => screen.getAllByTestId('row-title').map(e => e.textContent)

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
})
afterEach(() => vi.restoreAllMocks())

describe('SetBuilderPage', () => {
  it('unknown id shows friendly not-found', async () => {
    renderPage('nope')
    expect(await screen.findByText('Set not found')).toBeInTheDocument()
  })

  it('header shows total vs target and remaining', async () => {
    const { set } = await seed([300, 380])
    renderPage(set.id)
    expect(await screen.findByTestId('set-total')).toHaveTextContent('12:20 of 15:00')
    expect(screen.getByTestId('set-remaining')).toHaveTextContent('2:40 left')
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('data-over')
  })

  it('over target caps bar at 100% and flags warning', async () => {
    const { set } = await seed([600, 600])
    renderPage(set.id)
    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('data-over', 'true')
    expect(screen.getByTestId('set-remaining')).toHaveTextContent('6:00 over')
    const w = (id: string) => parseFloat(screen.getByTestId(id).style.width)
    expect(w('progress-jokes') + w('progress-buffer')).toBeLessThanOrEqual(100.0001)
    expect(w('progress-jokes')).toBe(100)
  })

  it('targetSec 0 and empty set produce no NaN/Infinity', async () => {
    const empty = await createSet({ name: 'E', targetSec: 0 })
    const { container } = renderPage(empty.id)
    await screen.findByTestId('set-total')
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(screen.getByText('No jokes in this set yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('weak-hint')).toBeNull()
  })

  it('targetSec 0 with jokes has no NaN width', async () => {
    const { set } = await seed([60], { targetSec: 0 })
    const { container } = renderPage(set.id)
    await screen.findByTestId('set-total')
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it('skips items whose joke was deleted', async () => {
    const { set, jokes } = await seed([60, 60, 60])
    await db.jokes.delete(jokes[1].id)
    renderPage(set.id)
    await screen.findByTestId('set-total')
    expect(titles()).toEqual(['J1', 'J3'])
    expect(screen.getByTestId('set-total')).toHaveTextContent('3:00 of 15:00')
  })

  it('role and segue persist', async () => {
    const { set } = await seed([60, 60])
    renderPage(set.id)
    const selects = await screen.findAllByLabelText('Role')
    await userEvent.selectOptions(selects[0], 'opener')
    const segues = screen.getAllByLabelText('Segue')
    await userEvent.type(segues[1], 'so anyway')
    await userEvent.tab()
    await waitFor(async () => {
      const s = (await db.sets.get(set.id))!
      expect(s.items[0].role).toBe('opener')
      expect(s.items[1].segue).toBe('so anyway')
    })
    expect(screen.getByTestId('role-badge-it1')).toHaveTextContent('Opener')
  })

  it('removes an item', async () => {
    const { set } = await seed([60, 60])
    renderPage(set.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Remove J1' }))
    await waitFor(async () => expect((await db.sets.get(set.id))!.items.map(i => i.id)).toEqual(['it2']))
    await waitFor(() => expect(titles()).toEqual(['J2']))
  })

  it('edits name, venue, target and buffer', async () => {
    const { set } = await seed([60])
    renderPage(set.id)
    const name = await screen.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Friday')
    await userEvent.tab()
    const target = screen.getByLabelText('Target (m:ss)')
    await userEvent.clear(target)
    await userEvent.type(target, '20:00')
    await userEvent.tab()
    const buffer = screen.getByLabelText('Buffer (m:ss)')
    await userEvent.clear(buffer)
    await userEvent.type(buffer, '1:30')
    await userEvent.tab()
    await userEvent.type(screen.getByLabelText('Venue'), 'Comedy Cellar')
    await userEvent.tab()
    await waitFor(async () => {
      const s = (await db.sets.get(set.id))!
      expect(s).toMatchObject({ name: 'Friday', targetSec: 1200, bufferSec: 90, venue: 'Comedy Cellar' })
    })
  })

  it('invalid target text is rejected and reverts', async () => {
    const { set } = await seed([60])
    renderPage(set.id)
    const target = await screen.findByLabelText('Target (m:ss)')
    await userEvent.clear(target)
    await userEvent.type(target, 'abc')
    await userEvent.tab()
    expect((await db.sets.get(set.id))!.targetSec).toBe(900)
    await waitFor(() => expect(target).toHaveValue('15:00'))
  })

  it('invalid target or buffer shows the m:ss alert, cleared on a valid edit', async () => {
    const { set } = await seed([60])
    renderPage(set.id)
    const target = await screen.findByLabelText('Target (m:ss)')
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.clear(target)
    await userEvent.type(target, 'abc')
    await userEvent.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Use m:ss, for example 15:00.')
    await userEvent.clear(target)
    await userEvent.type(target, '20:00')
    await userEvent.tab()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    const buffer = screen.getByLabelText('Buffer (m:ss)')
    await userEvent.clear(buffer)
    await userEvent.type(buffer, 'x')
    await userEvent.tab()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('total updates live when a joke manualTimeSec changes', async () => {
    const { set, jokes } = await seed([300])
    renderPage(set.id)
    expect(await screen.findByTestId('set-total')).toHaveTextContent('6:00 of 15:00')
    await updateJoke(jokes[0].id, { manualTimeSec: 600 })
    await waitFor(() => expect(screen.getByTestId('set-total')).toHaveTextContent('11:00 of 15:00'))
  })

  it('stats show average, count, untested and weak-spot hint naming the joke', async () => {
    const { set, jokes } = await seed([60, 60, 60, 60])
    const scores = [9, 6, 9]
    for (let i = 0; i < 3; i++) {
      await addPerformance({ jokeId: jokes[i].id, date: '2026-01-01', venue: 'Club', score: scores[i] })
    }
    renderPage(set.id)
    await waitFor(() => expect(screen.getByTestId('stat-avg')).toHaveTextContent('8.0'))
    expect(screen.getByTestId('stat-count')).toHaveTextContent('4')
    expect(screen.getByTestId('stat-untested')).toHaveTextContent('1')
    expect(screen.getByTestId('weak-hint')).toHaveTextContent('J2')
  })

  it('no weak spots with fewer than 3 items', async () => {
    const { set, jokes } = await seed([60, 60])
    await addPerformance({ jokeId: jokes[0].id, date: '2026-01-01', venue: 'Club', score: 9 })
    await addPerformance({ jokeId: jokes[1].id, date: '2026-01-01', venue: 'Club', score: 1 })
    renderPage(set.id)
    await waitFor(() => expect(screen.getByTestId('stat-avg')).toHaveTextContent('5.0'))
    expect(screen.queryByTestId('weak-hint')).toBeNull()
  })

  it('has stage link, print and duplicate actions', async () => {
    const { set } = await seed([60])
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderPage(set.id)
    expect(await screen.findByRole('link', { name: 'Stage mode' })).toHaveAttribute('href', `/sets/${set.id}/stage`)
    await userEvent.click(screen.getByRole('button', { name: 'Print set list' }))
    expect(print).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate set' }))
    await waitFor(async () => expect(await db.sets.count()).toBe(2))
  })

  it('reorders by keyboard and persists', async () => {
    // jsdom has no layout: stack rows vertically so dnd-kit can compute moves
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const idx = Number(this.closest('[data-row-index]')?.getAttribute('data-row-index') ?? -1)
      const top = idx < 0 ? 0 : idx * 50
      return { x: 0, y: top, top, left: 0, width: 300, height: 50, right: 300, bottom: top + 50, toJSON() {} } as DOMRect
    })
    const { set } = await seed([60, 60, 60])
    renderPage(set.id)
    const handle = await screen.findByRole('button', { name: 'Reorder J1' })
    handle.focus()
    fireEvent.keyDown(handle, { code: 'Space', key: ' ' })
    // the sensor attaches its document listeners on a timeout
    await new Promise(r => setTimeout(r, 20))
    fireEvent.keyDown(document, { code: 'ArrowDown', key: 'ArrowDown' })
    await new Promise(r => setTimeout(r, 20))
    fireEvent.keyDown(document, { code: 'Space', key: ' ' })
    await waitFor(async () => {
      expect((await db.sets.get(set.id))!.items.map(i => i.id)).toEqual(['it2', 'it1', 'it3'])
    })
    await waitFor(() => expect(titles()).toEqual(['J2', 'J1', 'J3']))
    expect(within(screen.getAllByRole('listitem')[0]).getByTestId('row-title')).toHaveTextContent('J2')
  })
})
