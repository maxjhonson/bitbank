import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { createChunk, createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { AddToSetMenu } from './AddToSetMenu'
import { UsedIn } from './UsedIn'

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear(), db.chunks.clear()])
})

const wrap = (ui: React.ReactNode) => render(<I18nProvider><MemoryRouter>{ui}</MemoryRouter></I18nProvider>)

describe('AddToSetMenu', () => {
  it('lists sets; choosing adds once, second add is a no-op', async () => {
    const j = await createJoke({ title: 'J' })
    const s = await createSet({ name: 'Friday' })
    await createSet({ name: 'Saturday' })
    wrap(<AddToSetMenu jokeId={j.id} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add to set' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Friday' }))
    await waitFor(async () => expect((await db.sets.get(s.id))!.items).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: /Friday/ }))
    await new Promise(r => setTimeout(r, 50))
    expect((await db.sets.get(s.id))!.items).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Saturday' })).toBeInTheDocument()
  })

  it('New set creates a set containing the joke', async () => {
    const j = await createJoke({ title: 'J' })
    wrap(<AddToSetMenu jokeId={j.id} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add to set' }))
    await userEvent.click(screen.getByRole('button', { name: 'New set' }))
    await waitFor(async () => {
      const all = await db.sets.toArray()
      expect(all).toHaveLength(1)
      expect(all[0].items.map(i => (i as { jokeId: string }).jokeId)).toEqual([j.id])
    })
  })
})

describe('AddToSetMenu with chunks', () => {
  it('a chunk containing the joke does not count as the joke being in the set', async () => {
    const j = await createJoke({ title: 'J' })
    const ch = await createChunk({ title: 'C', items: [{ jokeId: j.id }] })
    const s = await createSet({ name: 'Friday', items: [{ id: 'k', kind: 'chunk', chunkId: ch.id }] })
    wrap(<AddToSetMenu jokeId={j.id} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add to set' }))
    expect(await screen.findByRole('button', { name: 'Friday' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Friday' }))
    await waitFor(async () => expect((await db.sets.get(s.id))!.items).toHaveLength(2))
  })
})

describe('UsedIn groups', () => {
  it('shows direct sets, chunks and sets via a chunk', async () => {
    const j = await createJoke({ title: 'J' })
    const ch = await createChunk({ title: 'Airport', items: [{ jokeId: j.id }] })
    await createSet({ name: 'Direct', items: [{ id: 'i', kind: 'joke', jokeId: j.id }] })
    await createSet({ name: 'ViaChunk', items: [{ id: 'k', kind: 'chunk', chunkId: ch.id }] })
    await createSet({ name: 'Skipped', items: [{ id: 'k2', kind: 'chunk', chunkId: ch.id, skippedJokeIds: [j.id] }] })
    wrap(<UsedIn jokeId={j.id} />)
    expect(await screen.findByRole('link', { name: 'Direct' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Airport' })).toHaveAttribute('href', `/chunks/${ch.id}`)
    expect(screen.getByRole('link', { name: 'ViaChunk' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Skipped' })).toBeNull()
    expect(screen.getByText('Sets using it directly')).toBeInTheDocument()
    expect(screen.getByText('Chunks containing it')).toBeInTheDocument()
    expect(screen.getByText('Sets using it through a chunk')).toBeInTheDocument()
  })
  it('shows the none text when nothing uses it', async () => {
    const j = await createJoke({ title: 'J' })
    wrap(<UsedIn jokeId={j.id} />)
    expect(await screen.findByText('Not used in any set.')).toBeInTheDocument()
  })
})

describe('UsedIn', () => {
  it('links to /sets/:id', async () => {
    const j = await createJoke({ title: 'J' })
    const s = await createSet({ name: 'Friday', items: [{ id: 'i', kind: 'joke', jokeId: j.id }] })
    await createSet({ name: 'Other' })
    wrap(<UsedIn jokeId={j.id} />)
    const link = await screen.findByRole('link', { name: 'Friday' })
    expect(link).toHaveAttribute('href', `/sets/${s.id}`)
    expect(screen.queryByRole('link', { name: 'Other' })).toBeNull()
  })
})
