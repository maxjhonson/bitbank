import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { createJoke, createSet, db, addIdea, addPerformance } from '../db'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../ui/Toast/Toast'

function accessibleName(el: Element): string {
  const aria = el.getAttribute('aria-label')?.trim()
  if (aria) return aria
  const lb = el.getAttribute('aria-labelledby')
  if (lb) {
    const t = lb.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if (t) return t
  }
  return (el.textContent ?? '').trim() || (el.getAttribute('title') ?? '').trim()
}

function hasLabel(el: Element): boolean {
  if (accessibleName(el)) return true
  if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true
  return !!el.closest('label')
}

async function renderAt(url: string) {
  localStorage.setItem('bitbank.lang', 'en')
  return render(
    <I18nProvider><ToastProvider>
      <MemoryRouter initialEntries={[url]}><App /></MemoryRouter>
    </ToastProvider></I18nProvider>,
  )
}

let jokeId = ''
let setId = ''
beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()))
  const j = await createJoke({ title: 'Airports', setup: 'one two three', punchline: 'boom', tags: ['travel'] })
  jokeId = j.id
  await addPerformance({ jokeId, date: '2026-10-01', venue: 'Club', score: 8, durationSec: 30 })
  const s = await createSet({ name: 'Friday' })
  setId = s.id
  const { updateSet } = await import('../db')
  await updateSet(s.id, { items: [{ id: 'i1', jokeId }] })
  await addIdea('an idea')
})

describe('accessibility: every route', () => {
  const routes = () => [
    ['/', 'Airports'],
    [`/jokes/${jokeId}`, null],
    ['/sets', null],
    [`/sets/${setId}`, null],
    [`/sets/${setId}/stage`, null],
    ['/notebook', 'an idea'],
    ['/settings', null],
    ['/nope', null],
  ] as const
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) {
    it(`route #${i} renders without throwing; buttons, links, fields are named`, async () => {
      const [url, marker] = routes()[i]
      const { container } = await renderAt(url)
      if (marker) await screen.findAllByText(marker)
      else await waitFor(() => expect(container.querySelector('h1, h2, input, button')).not.toBeNull())
      await new Promise(r => setTimeout(r, 150))
      for (const el of container.querySelectorAll('button, a[href]')) {
        expect(accessibleName(el), `${url}: ${el.outerHTML.slice(0, 120)}`).not.toBe('')
      }
      for (const el of container.querySelectorAll('input:not([type=hidden]), textarea, select')) {
        expect(hasLabel(el), `${url}: ${el.outerHTML.slice(0, 120)}`).toBe(true)
      }
    })
  }
})
