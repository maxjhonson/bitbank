import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { createChunk, createJoke, createSet, db } from '../../db'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { SetBuilderPage } from './SetBuilderPage'

function renderPage(id: string) {
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[`/sets/${id}`]}>
        <Routes><Route path="/sets/:id" element={<SetBuilderPage />} /></Routes>
      </MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}
const bank = () => screen.queryAllByTestId('bank-title').map(e => e.textContent)

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  await Promise.all([db.jokes.clear(), db.performances.clear(), db.sets.clear(), db.chunks.clear()])
})

describe('JokeBank', () => {
  it('default filter: fits remaining time and not in this set; unscored listed', async () => {
    const inSet = await createJoke({ title: 'InSet', manualTimeSec: 60 })
    await createJoke({ title: 'Small', manualTimeSec: 30 })
    await createJoke({ title: 'Big', manualTimeSec: 600 })
    const set = await createSet({ targetSec: 120, bufferSec: 0, items: [{ id: 'a', kind: 'joke', jokeId: inSet.id }] })
    renderPage(set.id)
    await waitFor(() => expect(bank()).toEqual(['Small']))
    await userEvent.click(screen.getByLabelText('Only jokes that fit the remaining time'))
    await waitFor(() => expect(bank().sort()).toEqual(['Big', 'Small']))
  })

  it('search narrows the list', async () => {
    await createJoke({ title: 'Airline', manualTimeSec: 30 })
    await createJoke({ title: 'Dentist', manualTimeSec: 30 })
    const set = await createSet({ targetSec: 900 })
    renderPage(set.id)
    await waitFor(() => expect(bank().sort()).toEqual(['Airline', 'Dentist']))
    await userEvent.type(screen.getByLabelText('Search jokes'), 'dent')
    await waitFor(() => expect(bank()).toEqual(['Dentist']))
  })

  it('+ appends to the end and removes it from the bank', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 30 })
    await createJoke({ title: 'B', manualTimeSec: 30 })
    const set = await createSet({ targetSec: 900, items: [{ id: 'x', kind: 'joke', jokeId: a.id }] })
    renderPage(set.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Add B to set' }))
    await waitFor(async () => {
      const items = (await db.sets.get(set.id))!.items
      expect(items).toHaveLength(2)
      expect(items[0].id).toBe('x')
    })
    await waitFor(() => expect(bank()).toEqual([]))
  })

  it('lists a chunk with time and score, adds it, and it disappears from the bank once in the set', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 60 })
    const b = await createJoke({ title: 'B', manualTimeSec: 30 })
    const chunk = await createChunk({ title: 'Airport', items: [{ jokeId: a.id }, { jokeId: b.id }] })
    const set = await createSet({ targetSec: 900 })
    renderPage(set.id)
    const row = (await screen.findByTestId('bank-chunk-title')).closest('li')!
    expect(screen.getByTestId('bank-chunk-title')).toHaveTextContent('Airport')
    expect(row).toHaveTextContent('2 jokes')
    expect(row).toHaveTextContent('1:30')
    await userEvent.click(screen.getByRole('button', { name: 'Add chunk Airport to set' }))
    await waitFor(async () => {
      expect((await db.sets.get(set.id))!.items).toMatchObject([{ kind: 'chunk', chunkId: chunk.id }])
    })
    await waitFor(() => expect(screen.queryByTestId('bank-chunk-title')).toBeNull())
  })

  it('fits-remaining filter uses the chunk full time; search filters chunks; empty chunks list', async () => {
    const a = await createJoke({ title: 'A', manualTimeSec: 100 })
    await createChunk({ title: 'Big', items: [{ jokeId: a.id }] })
    await createChunk({ title: 'Empty', items: [] })
    const set = await createSet({ targetSec: 60, bufferSec: 0 })
    renderPage(set.id)
    await waitFor(() => expect(screen.getAllByTestId('bank-chunk-title').map(e => e.textContent)).toEqual(['Empty']))
    await userEvent.click(screen.getByLabelText('Only jokes that fit the remaining time'))
    await waitFor(() => expect(screen.getAllByTestId('bank-chunk-title')).toHaveLength(2))
    await userEvent.type(screen.getByLabelText('Search jokes'), 'big')
    await waitFor(() => expect(screen.getAllByTestId('bank-chunk-title').map(e => e.textContent)).toEqual(['Big']))
  })
})
