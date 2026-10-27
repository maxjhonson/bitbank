import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { createJoke, createSet, db, addIdea, addPerformance } from '../db'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../ui/Toast/Toast'

function ariaName(el: Element): string {
  const aria = el.getAttribute('aria-label')?.trim()
  if (aria) return aria
  const lb = el.getAttribute('aria-labelledby')
  if (lb) {
    const t = lb.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if (t) return t
  }
  return ''
}

/** Buttons and links: aria name, text content or title. */
function accessibleName(el: Element): string {
  return ariaName(el) || (el.textContent ?? '').trim() || (el.getAttribute('title') ?? '').trim()
}

/** Form fields: only aria-label(ledby), label[for] or an ancestor label with text. Never option/content text. */
function hasLabel(el: Element): boolean {
  if (ariaName(el)) return true
  if (el.id) {
    for (const l of document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)) if ((l.textContent ?? '').trim()) return true
  }
  const wrap = el.closest('label')
  if (!wrap) return false
  const clone = wrap.cloneNode(true) as HTMLElement
  clone.querySelectorAll('input, select, textarea').forEach(n => n.remove())
  return (clone.textContent ?? '').trim() !== ''
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
  type Marker = () => Promise<unknown>
  const routes = (): [string, Marker][] => [
    ['/', () => screen.findAllByText('Airports')],
    [`/jokes/${jokeId}`, () => screen.findByDisplayValue('Airports')],
    ['/sets', () => screen.findByDisplayValue('Friday')],
    [`/sets/${setId}`, () => screen.findAllByText('Airports')],
    [`/sets/${setId}/stage`, () => screen.findAllByText('Airports')],
    ['/notebook', () => screen.findAllByText('an idea')],
    ['/settings', () => screen.findByRole('heading', { name: 'Settings' })],
    ['/nope', () => screen.findByRole('heading', { name: 'Page not found' })],
  ]
  for (let i = 0; i < 8; i++) {
    it(`route #${i} renders seeded content; buttons, links, fields are named`, async () => {
      const [url, marker] = routes()[i]
      const { container } = await renderAt(url)
      await marker()
      for (const el of container.querySelectorAll('button, a[href]')) {
        expect(accessibleName(el), `${url}: ${el.outerHTML.slice(0, 120)}`).not.toBe('')
      }
      for (const el of container.querySelectorAll('input:not([type=hidden]), textarea, select')) {
        expect(hasLabel(el), `${url}: ${el.outerHTML.slice(0, 120)}`).toBe(true)
      }
    })
  }
})
