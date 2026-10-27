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
    const s = await createSet({ name: 'Friday', items: [{ id: 'a', jokeId: j.id }, { id: 'b', jokeId: keep.id }] })
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
