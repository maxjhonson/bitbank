import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { AddToSetMenu } from './AddToSetMenu'
import { UsedIn } from './UsedIn'

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear()])
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
