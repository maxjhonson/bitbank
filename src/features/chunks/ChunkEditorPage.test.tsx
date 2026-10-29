import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChunk, createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { ChunkEditorPage } from './ChunkEditorPage'

function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname + l.search}</div>
}
function renderPage(id: string) {
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[`/chunks/${id}`]}>
        <Routes>
          <Route path="/chunks/:id" element={<ChunkEditorPage />} />
          <Route path="/" element={<Where />} />
          <Route path="/sets/:id" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}

async function seed(n = 3, o: Parameters<typeof createChunk>[0] = {}) {
  const jokes = []
  for (let i = 0; i < n; i++) jokes.push(await createJoke({ title: `J${i + 1}`, manualTimeSec: 60 }))
  const chunk = await createChunk({ title: 'Bit', items: jokes.map(j => ({ jokeId: j.id })), ...o })
  return { jokes, chunk }
}
const rowTitles = () => screen.getAllByTestId('row-title').map(e => e.textContent)

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear(), db.chunks.clear()])
})
afterEach(() => vi.restoreAllMocks())

describe('ChunkEditorPage', () => {
  it('missing id shows not-found', async () => {
    renderPage('nope')
    expect(await screen.findByText('Chunk not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to chunks' })).toHaveAttribute('href', '/?view=chunks')
  })

  it('shows total time', async () => {
    const { chunk } = await seed(2)
    renderPage(chunk.id)
    expect(await screen.findByTestId('chunk-total')).toHaveTextContent('2:00')
  })

  it('edits title and notes', async () => {
    const { chunk } = await seed(1)
    renderPage(chunk.id)
    const title = await screen.findByLabelText('Chunk title')
    await userEvent.clear(title)
    await userEvent.type(title, 'New name')
    fireEvent.blur(title)
    await waitFor(async () => expect((await db.chunks.get(chunk.id))!.title).toBe('New name'))
    const notes = screen.getByLabelText('Notes')
    await userEvent.type(notes, 'remember pause')
    fireEvent.blur(notes)
    await waitFor(async () => expect((await db.chunks.get(chunk.id))!.notes).toBe('remember pause'))
  })

  it('picker adds a joke, never twice', async () => {
    const { chunk } = await seed(1)
    await createJoke({ title: 'Extra' })
    renderPage(chunk.id)
    await screen.findByLabelText('Chunk title')
    expect(screen.queryByRole('button', { name: 'Add J1' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Add Extra' }))
    await waitFor(async () => expect((await db.chunks.get(chunk.id))!.items).toHaveLength(2))
    await waitFor(() => expect(rowTitles()).toEqual(['J1', 'Extra']))
    expect(screen.queryByRole('button', { name: 'Add Extra' })).not.toBeInTheDocument()
  })

  it('picker search filters candidates', async () => {
    const { chunk } = await seed(1)
    await createJoke({ title: 'Alpha' })
    await createJoke({ title: 'Beta' })
    renderPage(chunk.id)
    await screen.findByRole('button', { name: 'Add Alpha' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search jokes to add' }), { target: { value: 'bet' } })
    expect(screen.queryByRole('button', { name: 'Add Alpha' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Beta' })).toBeInTheDocument()
  })

  it('reorders by keyboard and persists', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const idx = Number(this.closest('[data-row-index]')?.getAttribute('data-row-index') ?? -1)
      const top = idx < 0 ? 0 : idx * 50
      return { x: 0, y: top, top, left: 0, width: 300, height: 50, right: 300, bottom: top + 50, toJSON() {} } as DOMRect
    })
    const { chunk, jokes } = await seed(3)
    renderPage(chunk.id)
    const handle = await screen.findByRole('button', { name: 'Reorder J1' })
    handle.focus()
    fireEvent.keyDown(handle, { code: 'Space', key: ' ' })
    await new Promise(r => setTimeout(r, 20))
    fireEvent.keyDown(document, { code: 'ArrowDown', key: 'ArrowDown' })
    await new Promise(r => setTimeout(r, 20))
    fireEvent.keyDown(document, { code: 'Space', key: ' ' })
    await waitFor(async () => {
      expect((await db.chunks.get(chunk.id))!.items.map(i => i.jokeId)).toEqual([jokes[1].id, jokes[0].id, jokes[2].id])
    })
    await waitFor(() => expect(rowTitles()).toEqual(['J2', 'J1', 'J3']))
  })

  it('remove joke from chunk', async () => {
    const { chunk, jokes } = await seed(2)
    renderPage(chunk.id)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove J1' }))
    await waitFor(async () => expect((await db.chunks.get(chunk.id))!.items.map(i => i.jokeId)).toEqual([jokes[1].id]))
    await waitFor(() => expect(rowTitles()).toEqual(['J2']))
    expect(await db.jokes.get(jokes[0].id)).toBeTruthy()
  })

  it('segue field shown on every row except the last, and saves', async () => {
    const { chunk, jokes } = await seed(3)
    renderPage(chunk.id)
    await screen.findAllByTestId('row-title')
    const fields = screen.getAllByLabelText('Segue to next joke')
    expect(fields).toHaveLength(2)
    await userEvent.type(fields[0], 'Speaking of cats')
    fireEvent.blur(fields[0])
    await waitFor(async () => expect((await db.chunks.get(chunk.id))!.items[0]).toEqual({ jokeId: jokes[0].id, segue: 'Speaking of cats' }))
  })

  it('retired joke shows a retired badge', async () => {
    const { chunk } = await seed(1)
    await db.jokes.toCollection().modify({ status: 'retired' })
    renderPage(chunk.id)
    expect(await screen.findByText('retired')).toBeInTheDocument()
  })

  it('rows for missing jokes do not render or crash', async () => {
    const { chunk, jokes } = await seed(2)
    await db.jokes.delete(jokes[0].id)
    renderPage(chunk.id)
    await waitFor(() => expect(rowTitles()).toEqual(['J2']))
  })

  it('used-in lists sets', async () => {
    const { chunk } = await seed(1)
    const set = await createSet({ name: 'Friday show', items: [{ id: 'c1', kind: 'chunk', chunkId: chunk.id }] })
    renderPage(chunk.id)
    const link = await screen.findByRole('link', { name: 'Friday show' })
    expect(link).toHaveAttribute('href', `/sets/${set.id}`)
  })

  it('delete chunk dialog lists affected sets and deletes', async () => {
    const { chunk } = await seed(1)
    await createSet({ name: 'Friday show', items: [{ id: 'c1', kind: 'chunk', chunkId: chunk.id }] })
    renderPage(chunk.id)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete chunk' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByTestId('affected-sets')).toHaveTextContent('Friday show')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete chunk' }))
    await waitFor(async () => expect(await db.chunks.get(chunk.id)).toBeUndefined())
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/?view=chunks'))
    expect((await db.sets.toArray())[0].items).toEqual([])
  })

  it('Escape closes the delete dialog', async () => {
    const { chunk } = await seed(1)
    renderPage(chunk.id)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete chunk' }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await db.chunks.get(chunk.id)).toBeTruthy()
  })
})
