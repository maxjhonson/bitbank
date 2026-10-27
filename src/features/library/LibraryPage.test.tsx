import userEvent from '@testing-library/user-event'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPerformance, createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { AppShell } from '../shell/AppShell'
import { LibraryPage } from './LibraryPage'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}
function renderPage(url = '/') {
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/jokes/:id" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
})
afterEach(() => vi.useRealTimers())

describe('LibraryPage', () => {
  it('shows empty state with no jokes', async () => {
    renderPage()
    expect(await screen.findByText(/No jokes yet/)).toBeInTheDocument()
  })

  it('header shows count, material time and stage-tested time (rehearsals excluded)', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    await createJoke({ title: 'B', manualTimeSec: 30 })
    const c = await createJoke({ title: 'C', manualTimeSec: 20 })
    await addPerformance({ jokeId: a.id, date: '2026-01-01', venue: 'Club', score: 8 })
    await addPerformance({ jokeId: c.id, date: '2026-01-01', venue: 'Rehearsal', score: 8 })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('stat-jokes')).toHaveTextContent('3'))
    await waitFor(() => expect(screen.getByTestId('stat-material')).toHaveTextContent('1:50'))
    await waitFor(() => expect(screen.getByTestId('stat-tested')).toHaveTextContent('1:00'))
  })

  it('status chips show counts, sidebar shows counts and pinned tags link to ?tag=', async () => {
    await createJoke({ title: 'A', status: 'tight', tags: ['family'] })
    await createJoke({ title: 'B', status: 'tight', tags: ['family', 'work'] })
    await createSet({ name: 'S' })
    renderPage()
    expect(await screen.findByRole('button', { name: 'Tight 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draft 0' })).toBeInTheDocument()
    expect(await screen.findByText('2 jokes')).toBeInTheDocument()
    expect(await screen.findByText('1 set')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: '#work' })
    expect(link).toHaveAttribute('href', '/?tag=work')
  })

  it('singular forms for 1 run and 1 set', async () => {
    const a = await createJoke({ title: 'A' })
    await addPerformance({ jokeId: a.id, date: '2026-01-01', venue: 'Club', score: 8 })
    await createSet({ name: 'S', items: [{ id: 'i1', jokeId: a.id }] })
    renderPage()
    expect(await screen.findByText('1 run')).toBeInTheDocument()
    expect(screen.getByText('In 1 set')).toBeInTheDocument()
    expect(screen.getByText('1 joke')).toBeInTheDocument()
  })

  it('empty state has a call to action that creates a joke', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Write your first joke' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/jokes\/.+/))
  })

  it('?tag= filters the list', async () => {
    await createJoke({ title: 'Fam joke', tags: ['family'] })
    await createJoke({ title: 'Work joke', tags: ['work'] })
    renderPage('/?tag=family')
    expect(await screen.findByText('Fam joke')).toBeInTheDocument()
    expect(screen.queryByText('Work joke')).not.toBeInTheDocument()
  })

  it('debounces search by 150ms', async () => {
    await createJoke({ title: 'Alpha' })
    await createJoke({ title: 'Beta' })
    renderPage()
    await screen.findByText('Alpha')
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search jokes' }), { target: { value: 'alp' } })
    act(() => void vi.advanceTimersByTime(100))
    expect(screen.getByText('Beta')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(60))
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('New joke creates a draft and navigates to its editor', async () => {
    renderPage()
    await screen.findByText(/No jokes yet/)
    fireEvent.click(screen.getByRole('button', { name: 'New joke' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/jokes\/.+/))
    const jokes = await db.jokes.toArray()
    expect(jokes).toHaveLength(1)
    expect(jokes[0].status).toBe('draft')
    expect(screen.getByTestId('where').textContent).toBe(`/jokes/${jokes[0].id}`)
  })

  it('tag select filters the list and works with the URL param', async () => {
    await createJoke({ title: 'Fam', tags: ['family'] })
    await createJoke({ title: 'Trav', tags: ['travel'] })
    renderPage()
    const select = await screen.findByLabelText('Tag')
    await waitFor(() => expect(screen.getByText('Fam')).toBeInTheDocument())
    await userEvent.selectOptions(select, 'travel')
    await waitFor(() => expect(screen.queryByText('Fam')).not.toBeInTheDocument())
    expect(screen.getByText('Trav')).toBeInTheDocument()
    await userEvent.selectOptions(select, '')
    expect(await screen.findByText('Fam')).toBeInTheDocument()
  })
})
