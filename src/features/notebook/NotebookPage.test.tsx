import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addIdea, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { NotebookPage } from './NotebookPage'

function renderPage() {
  return render(<I18nProvider><ToastProvider><MemoryRouter><NotebookPage /></MemoryRouter></ToastProvider></I18nProvider>)
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.ideas.clear(), db.jokes.clear()])
})

describe('NotebookPage', () => {
  it('shows empty state', async () => {
    renderPage()
    expect(await screen.findByText(/No ideas yet/)).toBeInTheDocument()
  })

  it('Enter saves trimmed idea and clears input', async () => {
    renderPage()
    const input = await screen.findByLabelText('Quick capture')
    await userEvent.type(input, '  airline food  {Enter}')
    await waitFor(async () => expect(await db.ideas.count()).toBe(1))
    expect((await db.ideas.toArray())[0].text).toBe('airline food')
    expect(input).toHaveValue('')
    expect(await screen.findByText('airline food')).toBeInTheDocument()
  })

  it('blank Enter saves nothing', async () => {
    renderPage()
    const input = await screen.findByLabelText('Quick capture')
    await userEvent.type(input, '   {Enter}')
    await userEvent.type(input, '{Enter}')
    expect(await db.ideas.count()).toBe(0)
  })

  it('lists newest first', async () => {
    await addIdea('first')
    await new Promise((r) => setTimeout(r, 5))
    await addIdea('second')
    renderPage()
    await screen.findByText('second')
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('second')
    expect(items[1]).toHaveTextContent('first')
  })

  it('promotes to a draft joke, shows link, disables button', async () => {
    const idea = await addIdea('dogs')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Promote/ }))
    const item = (await screen.findByText('Promoted')).closest('li')!
    const jokes = await db.jokes.toArray()
    expect(jokes).toHaveLength(1)
    expect(jokes[0].premise).toBe('dogs')
    expect(jokes[0].status).toBe('draft')
    expect(within(item).getByRole('link')).toHaveAttribute('href', `/jokes/${jokes[0].id}`)
    expect(within(item).queryByRole('button', { name: /Promote/ })).toBeNull()
    expect((await db.ideas.get(idea.id))?.promotedJokeId).toBe(jokes[0].id)
  })

  it('deletes an idea', async () => {
    await addIdea('gone')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Delete/ }))
    await waitFor(async () => expect(await db.ideas.count()).toBe(0))
    expect(await screen.findByText(/No ideas yet/)).toBeInTheDocument()
  })

  it('ignores Enter during IME composition', async () => {
    renderPage()
    const input = await screen.findByLabelText('Quick capture')
    await userEvent.type(input, 'caf')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(await db.ideas.count()).toBe(0)
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(async () => expect(await db.ideas.count()).toBe(1))
  })

  it('keeps input and shows a toast when saving fails', async () => {
    const spy = vi.spyOn(db.ideas, 'add').mockRejectedValueOnce(new Error('boom'))
    renderPage()
    const input = await screen.findByLabelText('Quick capture')
    await userEvent.type(input, 'keep me{Enter}')
    expect(await screen.findByText(/not saved/)).toBeInTheDocument()
    expect(input).toHaveValue('keep me')
    spy.mockRestore()
  })
})
