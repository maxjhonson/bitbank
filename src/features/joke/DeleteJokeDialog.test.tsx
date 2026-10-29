import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPerformance, createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { DeleteJokeDialog } from './DeleteJokeDialog'

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
})

const wrap = (ui: React.ReactNode) => render(<I18nProvider><MemoryRouter>{ui}</MemoryRouter></I18nProvider>)

describe('DeleteJokeDialog', () => {
  it('lists affected sets and deletes joke, performances and set items on confirm', async () => {
    const j = await createJoke({ title: 'Bit' })
    const keep = await createJoke({ title: 'Keep' })
    await addPerformance({ jokeId: j.id, date: '2026-10-01', venue: 'X', score: 6 })
    const s = await createSet({ name: 'Friday', items: [{ id: 'a', kind: 'joke', jokeId: j.id }, { id: 'b', kind: 'joke', jokeId: keep.id }] })
    const onDeleted = vi.fn()
    wrap(<DeleteJokeDialog jokeId={j.id} title="Bit" onClose={() => {}} onDeleted={onDeleted} />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('Friday')).toBeInTheDocument()
    expect(await db.jokes.get(j.id)).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Delete joke' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(await db.jokes.get(j.id)).toBeUndefined()
    expect(await db.performances.count()).toBe(0)
    expect((await db.sets.get(s.id))!.items.map(i => i.id)).toEqual(['b'])
  })

  it('cancel keeps everything', async () => {
    const j = await createJoke({ title: 'Bit' })
    const onClose = vi.fn()
    wrap(<DeleteJokeDialog jokeId={j.id} title="Bit" onClose={onClose} onDeleted={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(await db.jokes.get(j.id)).toBeDefined()
  })

  it('joke in no sets gets a simple confirm', async () => {
    const j = await createJoke({ title: 'Bit' })
    const onDeleted = vi.fn()
    wrap(<DeleteJokeDialog jokeId={j.id} title="Bit" onClose={() => {}} onDeleted={onDeleted} />)
    await screen.findByRole('dialog')
    expect(screen.queryByTestId('affected-sets')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Delete joke' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(await db.jokes.get(j.id)).toBeUndefined()
  })
})

describe('DeleteJokeDialog focus and errors', () => {
  it('focuses Cancel, traps Tab, restores focus on close', async () => {
    const j = await createJoke({ title: 'Bit' })
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          {open && <DeleteJokeDialog jokeId={j.id} title="Bit" onClose={() => setOpen(false)} onDeleted={() => {}} />}
        </>
      )
    }
    wrap(<Host />)
    const trigger = screen.getByRole('button', { name: 'open' })
    await userEvent.click(trigger)
    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveFocus()
    const del = await screen.findByRole('button', { name: 'Delete joke' })
    await waitFor(() => expect(del).toBeEnabled())
    await userEvent.tab()
    expect(del).toHaveFocus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(del).toHaveFocus()
    await userEvent.click(cancel)
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('shows an alert and stays usable when deleteJoke rejects', async () => {
    const j = await createJoke({ title: 'Bit' })
    const spy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('boom'))
    const onDeleted = vi.fn()
    wrap(<DeleteJokeDialog jokeId={j.id} title="Bit" onClose={() => {}} onDeleted={onDeleted} />)
    const del = await screen.findByRole('button', { name: 'Delete joke' })
    await waitFor(() => expect(del).toBeEnabled())
    await userEvent.click(del)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the joke')
    expect(onDeleted).not.toHaveBeenCalled()
    await waitFor(() => expect(del).toBeEnabled())
    spy.mockRestore()
    await userEvent.click(del)
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })
})
