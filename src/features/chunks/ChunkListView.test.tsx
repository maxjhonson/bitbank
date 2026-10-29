import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { createChunk, createJoke, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { AppShell } from '../shell/AppShell'
import { LibraryPage } from '../library/LibraryPage'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}
function renderPage(url = '/?view=chunks') {
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/chunks/:id" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear(), db.chunks.clear()])
})

describe('Chunks tab', () => {
  it('lists chunks with time and score', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const b = await createJoke({ title: 'B', manualTimeSec: 30 })
    await createChunk({ title: 'Airport bit', items: [{ jokeId: a.id }, { jokeId: b.id }] })
    renderPage()
    expect(await screen.findByText('Airport bit')).toBeInTheDocument()
    expect(screen.getByTestId('chunk-time')).toHaveTextContent('1:30')
    expect(screen.getByTestId('chunk-count')).toHaveTextContent('2 jokes')
    expect(screen.getByRole('link', { name: 'Open Airport bit' })).toHaveAttribute('href', expect.stringMatching(/^\/chunks\//))
  })

  it('New chunk creates and opens the editor', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'New chunk' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/chunks\/.+/))
    expect(await db.chunks.count()).toBe(1)
  })

  it('Jokes tab is the default and tabs switch views', async () => {
    await createJoke({ title: 'Solo joke' })
    await createChunk({ title: 'Some chunk' })
    renderPage('/')
    expect(await screen.findByText('Solo joke')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Jokes' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Chunks' }))
    expect(await screen.findByText('Some chunk')).toBeInTheDocument()
    expect(screen.queryByText('Solo joke')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Chunks' })).toHaveAttribute('aria-selected', 'true')
  })
})
