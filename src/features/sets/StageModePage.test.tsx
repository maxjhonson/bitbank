import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChunk, createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { StageModePage } from './StageModePage'
import { PrintSetList } from './PrintSetList'
import { useSetView, type SetView } from './useSetView'

function renderPage(id: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[`/sets/${id}/stage`]}>
        <Routes><Route path="/sets/:id/stage" element={<StageModePage />} /></Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear(), db.chunks.clear()])
})
afterEach(() => vi.useRealTimers())

async function seed() {
  const a = await createJoke({ title: 'Alpha', manualTimeSec: 60 })
  const b = await createJoke({ title: 'Bravo', manualTimeSec: 60 })
  const set = await createSet({
    name: 'Show',
    items: [{ id: 'i1', kind: 'joke', jokeId: a.id }, { id: 'i2', kind: 'joke', jokeId: b.id, segue: 'Speaking of birds' }],
  })
  return { a, b, set }
}

describe('StageModePage', () => {
  it('shows titles in running order and segues, with no edit controls', async () => {
    const { set } = await seed()
    const { container } = renderPage(set.id)
    const titles = await screen.findAllByTestId('stage-title')
    expect(titles.map(e => e.textContent)).toEqual(['Alpha', 'Bravo'])
    expect(screen.getByText('Speaking of birds')).toBeInTheDocument()
    expect(container.querySelector('input, textarea')).toBeNull()
  })

  it('renders the segue after its joke title and falls back for untitled jokes', async () => {
    const a = await createJoke({ title: '' })
    const set = await createSet({ name: 'S', items: [{ id: 'i1', kind: 'joke', jokeId: a.id, segue: 'bridge' }] })
    renderPage(set.id)
    const title = await screen.findByTestId('stage-title')
    expect(title).toHaveTextContent('Untitled')
    expect(title.nextElementSibling).toHaveTextContent('bridge')
  })

  it('unknown set shows not-found', async () => {
    renderPage('nope')
    expect(await screen.findByText('Set not found')).toBeInTheDocument()
  })

  it('empty set shows empty message', async () => {
    const s = await createSet({ name: 'E' })
    renderPage(s.id)
    expect(await screen.findByText('No jokes in this set yet.')).toBeInTheDocument()
  })

  it('skips items whose joke was deleted', async () => {
    const { set, a } = await seed()
    await db.jokes.delete(a.id)
    renderPage(set.id)
    const titles = await screen.findAllByTestId('stage-title')
    expect(titles.map(e => e.textContent)).toEqual(['Bravo'])
  })

  it('clock starts and pauses', async () => {
    const { set } = await seed()
    renderPage(set.id)
    await screen.findAllByTestId('stage-title')
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const clock = screen.getByTestId('stage-clock')
    expect(clock).toHaveTextContent('0:00')
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(clock).toHaveTextContent('0:05')
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(clock).toHaveTextContent('0:05')
  })
})

describe('StageModePage clock drift', () => {
  it('uses wall-clock time, not tick count', async () => {
    const { set } = await seed()
    renderPage(set.id)
    await screen.findAllByTestId('stage-title')
    vi.useFakeTimers({ shouldAdvanceTime: false })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    act(() => { vi.setSystemTime(Date.now() + 9_000); vi.advanceTimersToNextTimer() })
    expect(screen.getByTestId('stage-clock')).toHaveTextContent('0:10')
  })
})

describe('PrintSetList', () => {
  it('renders numbered titles in running order', () => {
    const row = (n: number, title: string) => ({ itemId: `i${n}`, slot: n, joke: { title } as never, sec: 0, score: null })
    const view = { set: { name: 'Show' }, rows: [row(1, 'Alpha'), row(2, 'Bravo')] } as unknown as SetView
    render(<I18nProvider><PrintSetList view={view} /></I18nProvider>)
    const items = screen.getAllByRole('listitem')
    expect(items.map(i => i.textContent)).toEqual(['Alpha', 'Bravo'])
    expect(screen.getByRole('list').tagName).toBe('OL')
  })
})

describe('chunk expansion', () => {
  async function seedChunk() {
    const a = await createJoke({ title: 'Alpha', manualTimeSec: 60 })
    const b = await createJoke({ title: 'Bravo', manualTimeSec: 60 })
    const c = await createJoke({ title: 'Charlie', manualTimeSec: 60 })
    const ch = await createChunk({ title: 'Airport', items: [{ jokeId: a.id, segue: 'then' }, { jokeId: b.id }, { jokeId: c.id }] })
    const set = await createSet({ name: 'Show', items: [{ id: 'k1', kind: 'chunk', chunkId: ch.id, skippedJokeIds: [b.id], segue: 'next up' }] })
    return set
  }
  it('stage mode shows ticked jokes, chunk label once, segues', async () => {
    const set = await seedChunk()
    renderPage(set.id)
    const titles = await screen.findAllByTestId('stage-title')
    expect(titles.map(e => e.textContent)).toEqual(['Alpha', 'Charlie'])
    expect(screen.getAllByText('Airport')).toHaveLength(1)
    expect(screen.getByText('then')).toBeInTheDocument()
    expect(screen.getByText('next up')).toBeInTheDocument()
  })
  it('print list renders the same lines', async () => {
    const set = await seedChunk()
    function P() {
      const view = useSetView(set.id)
      return view ? <PrintSetList view={view} /> : null
    }
    render(<I18nProvider><P /></I18nProvider>)
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.queryByText('Bravo')).toBeNull()
    expect(screen.getAllByText('Airport')).toHaveLength(1)
  })
})
