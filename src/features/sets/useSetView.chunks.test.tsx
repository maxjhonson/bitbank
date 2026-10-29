import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { addPerformance, createChunk, createJoke, createSet, db, useJokeStats } from '../../db'
import type { SetItem } from '../../domain/types'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { SetBuilderPage } from './SetBuilderPage'
import { SetListPage } from './SetListPage'

function renderPage(id: string) {
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[`/sets/${id}`]}>
        <Routes><Route path="/sets/:id" element={<SetBuilderPage />} /></Routes>
      </MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}

const perf = (jokeId: string, score: number) => addPerformance({ jokeId, date: '2026-01-01', venue: 'Club', score })
const mkSet = (items: SetItem[]) => createSet({ name: 'Show', targetSec: 900, bufferSec: 0, items })
const chunkItem = (id: string, chunkId: string, skippedJokeIds?: string[]): SetItem => ({ id, kind: 'chunk', chunkId, skippedJokeIds })

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear(), db.chunks.clear()])
})

describe('set view with chunks', () => {
  it('chunk row shows the sum of ticked jokes and the mean score', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const b = await createJoke({ title: 'B', manualTimeSec: 90 })
    await perf(a.id, 8)
    await perf(b.id, 6)
    const c = await createChunk({ title: 'Airline bit', items: [{ jokeId: a.id }, { jokeId: b.id }] })
    const set = await mkSet([chunkItem('c1', c.id)])
    renderPage(set.id)
    await waitFor(() => expect(screen.getByTestId('set-total')).toHaveTextContent('2:30 of 15:00'))
    expect(screen.getByTestId('row-title')).toHaveTextContent('Airline bit')
    expect(screen.getByTestId('stat-avg')).toHaveTextContent('7.0')
    expect(screen.getByTestId('stat-count')).toHaveTextContent('2')
  })

  it('skipping a joke lowers the set total, and stat-count counts ticked jokes', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const b = await createJoke({ title: 'B', manualTimeSec: 90 })
    const solo = await createJoke({ title: 'Solo', manualTimeSec: 30 })
    const c = await createChunk({ title: 'C', items: [{ jokeId: a.id }, { jokeId: b.id }] })
    const set = await mkSet([chunkItem('c1', c.id, [b.id]), { id: 'j1', kind: 'joke', jokeId: solo.id }])
    renderPage(set.id)
    await waitFor(() => expect(screen.getByTestId('set-total')).toHaveTextContent('1:30 of 15:00'))
    expect(screen.getByTestId('stat-count')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-untested')).toHaveTextContent('2')
  })

  it('a chunk with every joke skipped, an empty chunk, and a chunk whose only joke was deleted show 0:00 with no NaN, count as untested', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const gone = await createJoke({ title: 'Gone', manualTimeSec: 60 })
    const allSkipped = await createChunk({ title: 'Skipped', items: [{ jokeId: a.id }] })
    const empty = await createChunk({ title: 'Empty', items: [] })
    const orphan = await createChunk({ title: 'Orphan', items: [{ jokeId: gone.id }] })
    await db.jokes.delete(gone.id)
    const set = await mkSet([chunkItem('c1', allSkipped.id, [a.id]), chunkItem('c2', empty.id), chunkItem('c3', orphan.id)])
    const { container } = renderPage(set.id)
    await waitFor(() => expect(screen.getAllByTestId('row-title')).toHaveLength(3))
    expect(screen.getByTestId('set-total')).toHaveTextContent('0:00 of 15:00')
    expect(screen.getByTestId('stat-count')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-untested')).toHaveTextContent('3')
    expect(screen.getByTestId('stat-avg')).toHaveTextContent('–')
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it('a set item pointing to a missing chunk is skipped', async () => {
    const solo = await createJoke({ title: 'Solo', manualTimeSec: 30 })
    const set = await mkSet([chunkItem('c1', 'nope'), { id: 'j1', kind: 'joke', jokeId: solo.id }])
    renderPage(set.id)
    await waitFor(() => expect(screen.getByTestId('set-total')).toHaveTextContent('0:30 of 15:00'))
    expect(screen.getAllByTestId('row-title').map(e => e.textContent)).toEqual(['Solo'])
  })

  it('weak-spot hint can name a chunk by its title when its average is low in the middle of three items', async () => {
    const [x, y, z, w] = await Promise.all(['X', 'Y', 'Z', 'W'].map(title => createJoke({ title, manualTimeSec: 30 })))
    await perf(x.id, 9)
    await perf(y.id, 3)
    await perf(z.id, 3)
    await perf(w.id, 9)
    const c = await createChunk({ title: 'Cold bit', items: [{ jokeId: y.id }, { jokeId: z.id }] })
    const set = await mkSet([
      { id: 'j1', kind: 'joke', jokeId: x.id }, chunkItem('c1', c.id), { id: 'j2', kind: 'joke', jokeId: w.id },
    ])
    renderPage(set.id)
    await waitFor(() => expect(screen.getByTestId('weak-hint')).toHaveTextContent('Cold bit'))
  })

  it('set list total includes chunks', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const c = await createChunk({ title: 'C', items: [{ jokeId: a.id }] })
    await mkSet([chunkItem('c1', c.id)])
    render(<I18nProvider><ToastProvider><MemoryRouter><SetListPage /></MemoryRouter></ToastProvider></I18nProvider>)
    expect(await screen.findByText('1:00 of 15:00')).toBeInTheDocument()
  })

  it('usedIn counts via chunk only when ticked, once per set', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const b = await createJoke({ title: 'B', manualTimeSec: 60 })
    const d = await createJoke({ title: 'D', manualTimeSec: 60 })
    const c = await createChunk({ title: 'C', items: [{ jokeId: a.id }, { jokeId: b.id }, { jokeId: d.id }] })
    await mkSet([{ id: 'j1', kind: 'joke', jokeId: a.id }, chunkItem('c1', c.id, [b.id])])
    const { result } = renderHook(() => useJokeStats())
    await waitFor(() => expect(result.current?.get(d.id)?.usedIn).toBe(1))
    expect(result.current?.get(a.id)?.usedIn).toBe(1)
    expect(result.current?.get(b.id)?.usedIn).toBe(0)
  })
})
