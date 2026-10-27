import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { SetListPage } from './SetListPage'

function renderPage() {
  return render(
    <I18nProvider><ToastProvider><MemoryRouter><SetListPage /></MemoryRouter></ToastProvider></I18nProvider>,
  )
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
})

describe('SetListPage', () => {
  it('shows empty state', async () => {
    renderPage()
    expect(await screen.findByText(/No sets yet/)).toBeInTheDocument()
  })

  it('empty state has a call to action that creates a set', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Create your first set' }))
    await waitFor(async () => expect(await db.sets.count()).toBe(1))
  })

  it('creates a set', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'New set' }))
    await waitFor(async () => expect(await db.sets.count()).toBe(1))
    expect(await screen.findByLabelText('Set name')).toBeInTheDocument()
  })

  it('shows total vs target per set', async () => {
    const j = await createJoke({ title: 'A', manualTimeSec: 600 })
    await createSet({ name: 'Club', targetSec: 900, bufferSec: 60, items: [{ id: 'i1', jokeId: j.id }] })
    renderPage()
    expect(await screen.findByText('11:00 of 15:00')).toBeInTheDocument()
  })

  it('renames a set', async () => {
    const s = await createSet({ name: 'Old' })
    renderPage()
    const input = await screen.findByLabelText('Set name')
    await userEvent.clear(input)
    await userEvent.type(input, 'New name')
    await userEvent.tab()
    await waitFor(async () => expect((await db.sets.get(s.id))!.name).toBe('New name'))
  })

  it('duplicates a set', async () => {
    await createSet({ name: 'Orig' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate Orig' }))
    await waitFor(async () => expect(await db.sets.count()).toBe(2))
  })

  it('deletes only after confirm', async () => {
    await createSet({ name: 'Doomed' })
    const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPage()
    const btn = await screen.findByRole('button', { name: 'Delete Doomed' })
    await userEvent.click(btn)
    expect(await db.sets.count()).toBe(1)
    await userEvent.click(btn)
    await waitFor(async () => expect(await db.sets.count()).toBe(0))
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('target 0 set does not crash', async () => {
    await createSet({ name: 'Zero', targetSec: 0 })
    renderPage()
    const row = (await screen.findByLabelText('Set name')).closest('li')!
    expect(within(row).getByText('1:00 of 0:00')).toBeInTheDocument()
  })
})
