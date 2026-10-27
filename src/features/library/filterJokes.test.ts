import { describe, expect, it } from 'vitest'
import type { Joke, JokeStatus } from '../../domain/types'
import { filterAndSortJokes, type LibraryItem, type LibraryQuery } from './filterJokes'

function item(p: Partial<Joke> & { sec?: number; score?: number | null; runs?: number; usedIn?: number }): LibraryItem {
  const { sec = 30, score = null, runs = 0, usedIn = 0, ...j } = p
  return {
    joke: {
      id: j.id ?? Math.random().toString(36),
      title: '', premise: '', setup: '', punchline: '', tagLines: [], notes: '', status: 'draft', tags: [],
      versions: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...j,
    },
    sec, score, runs, usedIn,
  }
}
const q = (o: Partial<LibraryQuery> = {}): LibraryQuery => ({
  text: '', statuses: new Set<JokeStatus>(), minScore7: false, under60: false, notInSet: false, sort: 'title', ...o,
})
const ids = (xs: LibraryItem[]) => xs.map(x => x.joke.id)

describe('filterAndSortJokes', () => {
  it('searches title, premise, setup, punchline and tags case-insensitively', () => {
    const items = [
      item({ id: 'a', title: 'Airline FOOD' }),
      item({ id: 'b', premise: 'about airline' }),
      item({ id: 'c', setup: 'my Airline story' }),
      item({ id: 'd', punchline: 'AIRLINE!' }),
      item({ id: 'e', tags: ['airline'] }),
      item({ id: 'f', title: 'nope' }),
    ]
    expect(ids(filterAndSortJokes(items, q({ text: 'AirLine' }))).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('filters by status, tag, and combines filters', () => {
    const items = [
      item({ id: 'a', status: 'tight', tags: ['family'], score: 8 }),
      item({ id: 'b', status: 'tight', tags: ['work'], score: 8 }),
      item({ id: 'c', status: 'draft', tags: ['family'], score: 8 }),
    ]
    expect(ids(filterAndSortJokes(items, q({ statuses: new Set<JokeStatus>(['tight']), tag: 'family' })))).toEqual(['a'])
  })
  it('score >= 7 excludes null', () => {
    const items = [item({ id: 'a', score: 7 }), item({ id: 'b', score: 6.9 }), item({ id: 'c', score: null })]
    expect(ids(filterAndSortJokes(items, q({ minScore7: true })))).toEqual(['a'])
  })
  it('under 1 min means sec < 60', () => {
    const items = [item({ id: 'a', sec: 59 }), item({ id: 'b', sec: 60 })]
    expect(ids(filterAndSortJokes(items, q({ under60: true })))).toEqual(['a'])
  })
  it('notInSet keeps usedIn 0', () => {
    const items = [item({ id: 'a', usedIn: 0 }), item({ id: 'b', usedIn: 2 })]
    expect(ids(filterAndSortJokes(items, q({ notInSet: true })))).toEqual(['a'])
  })
  it('sorts', () => {
    const items = [
      item({ id: 'a', title: 'b', score: 5, sec: 10, updatedAt: '2026-01-02T00:00:00Z' }),
      item({ id: 'b', title: 'a', score: null, sec: 90, updatedAt: '2026-03-01T00:00:00Z' }),
      item({ id: 'c', title: 'c', score: 9, sec: 50, updatedAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(ids(filterAndSortJokes(items, q({ sort: 'score' })))).toEqual(['c', 'a', 'b'])
    expect(ids(filterAndSortJokes(items, q({ sort: 'time' })))).toEqual(['b', 'c', 'a'])
    expect(ids(filterAndSortJokes(items, q({ sort: 'updated' })))).toEqual(['b', 'c', 'a'])
    expect(ids(filterAndSortJokes(items, q({ sort: 'title' })))).toEqual(['b', 'a', 'c'])
  })
})
