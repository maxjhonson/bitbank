import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { createJoke, db, getJoke } from '../../db'
import { I18nProvider } from '../../i18n'
import { JokeEditorPage } from './JokeEditorPage'

function renderPage(id: string, state?: unknown) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[{ pathname: `/jokes/${id}`, state }]}>
        <Routes>
          <Route path="/" element={<div>library-home</div>} />
          <Route path="/jokes/:id" element={<JokeEditorPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
})

const fastType = (el: HTMLElement, text: string) => userEvent.type(el, text, { delay: null })

describe('JokeEditorPage', () => {
  it('unknown id renders a friendly not-found with a link to the Library', async () => {
    renderPage('nope')
    expect(await screen.findByText(/Joke not found/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Library/ })).toHaveAttribute('href', '/')
  })

  it('edits to every field persist after remount (unmount flushes within debounce)', async () => {
    const j = await createJoke()
    const first = renderPage(j.id)
    await fastType(await screen.findByLabelText('Title'), 'My bit')
    await fastType(screen.getByLabelText('Premise'), 'Premise text')
    await fastType(screen.getByLabelText('Setup'), 'Setup text')
    await fastType(screen.getByLabelText('Punchline'), 'Punch text')
    await fastType(screen.getByLabelText('Private notes'), 'Secret')
    first.unmount()
    await waitFor(async () => expect((await getJoke(j.id))?.punchline).toBe('Punch text'))
    const saved = (await getJoke(j.id))!
    expect(saved).toMatchObject({ title: 'My bit', premise: 'Premise text', setup: 'Setup text', notes: 'Secret' })
    renderPage(j.id)
    expect(await screen.findByLabelText('Title')).toHaveValue('My bit')
    expect(screen.getByLabelText("Private notes")).toHaveValue('Secret')
  })

  it('shows Saved with relative time after autosave', async () => {
    const j = await createJoke({ title: 'x' })
    renderPage(j.id)
    await fastType(await screen.findByLabelText('Title'), 'y')
    expect(await screen.findByText(/Saved/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('focuses the title when navigated from New joke or when empty', async () => {
    const j = await createJoke({ title: 'Has title' })
    renderPage(j.id, { focusTitle: true })
    expect(await screen.findByLabelText('Title')).toHaveFocus()
  })

  it('status selector changes status', async () => {
    const j = await createJoke()
    renderPage(j.id)
    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'tight')
    await waitFor(async () => expect((await getJoke(j.id))?.status).toBe('tight'))
  })

  it('normalizes typed tags and autocompletes from existing ones', async () => {
    await createJoke({ tags: ['family', 'work'] })
    const j = await createJoke()
    renderPage(j.id)
    const input = await screen.findByLabelText('Add tag')
    await userEvent.click(input)
    const list = await screen.findByRole('listbox')
    expect(within(list).getAllByRole('option').map(o => o.textContent)).toEqual(['family', 'work'])
    await userEvent.type(input, '#Family{Enter}')
    await waitFor(async () => expect((await getJoke(j.id))?.tags).toEqual(['family']))
    expect(await screen.findByText('#family')).toBeInTheDocument()
    await userEvent.type(input, 'wo')
    await userEvent.click(await screen.findByRole('option', { name: 'work' }))
    await waitFor(async () => expect((await getJoke(j.id))?.tags).toEqual(['family', 'work']))
  })

  it('tag lines: add, edit, kind, reorder, delete', async () => {
    const j = await createJoke()
    renderPage(j.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Add tag line' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add act-out' }))
    const texts = () => screen.getAllByLabelText('Line text')
    await fastType(texts()[0], 'first')
    await fastType(texts()[1], 'second')
    await userEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0])
    expect(texts().map(t => (t as HTMLInputElement).value)).toEqual(['second', 'first'])
    await userEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1])
    expect(texts().map(t => (t as HTMLInputElement).value)).toEqual(['first', 'second'])
    await userEvent.selectOptions(screen.getAllByLabelText('Kind')[0], 'act-out')
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete line' })[1])
    expect(texts()).toHaveLength(1)
    await waitFor(async () => {
      const tl = (await getJoke(j.id))!.tagLines
      expect(tl).toHaveLength(1)
      expect(tl[0]).toMatchObject({ text: 'first', kind: 'act-out' })
    })
  })

  it('restoring a version replaces setup and punchline', async () => {
    const j = await createJoke({
      setup: 'current s', punchline: 'current p',
      versions: [{ savedAt: '2026-01-01T10:00:00.000Z', setup: 'old s', punchline: 'old p' }],
    })
    renderPage(j.id)
    await userEvent.click(await screen.findByRole('button', { name: /Restore/ }))
    expect(screen.getByLabelText('Setup')).toHaveValue('old s')
    expect(screen.getByLabelText('Punchline')).toHaveValue('old p')
    await waitFor(async () => expect((await getJoke(j.id))?.setup).toBe('old s'))
  })

  it('shows time with source label and score placeholder', async () => {
    const j = await createJoke({ manualTimeSec: 65 })
    renderPage(j.id)
    expect(await screen.findByText('1:05')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByTestId('score-trend')).toBeInTheDocument()
  })
})

describe('JokeEditorPage delete', () => {
  it('deleting within the autosave debounce leaves the joke deleted without errors', async () => {
    const j = await createJoke({ title: 'Doomed' })
    const errs: unknown[] = []
    const onRej = (e: PromiseRejectionEvent) => errs.push(e)
    window.addEventListener('unhandledrejection', onRej)
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[`/jokes/${j.id}`]}>
          <Routes>
            <Route path="/jokes/:id" element={<JokeEditorPage />} />
            <Route path="/" element={<p>library</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    await userEvent.type(await screen.findByLabelText('Title'), ' edit')
    await userEvent.click(screen.getByRole('button', { name: 'Delete joke' }))
    const dlg = await screen.findByRole('dialog')
    const confirm = within(dlg).getByRole('button', { name: 'Delete joke' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await userEvent.click(confirm)
    expect(await screen.findByText('library')).toBeInTheDocument()
    await new Promise(r => setTimeout(r, 1000))
    expect(await getJoke(j.id)).toBeUndefined()
    expect(await db.jokes.count()).toBe(0)
    expect(errs).toEqual([])
    window.removeEventListener('unhandledrejection', onRej)
  })
})
