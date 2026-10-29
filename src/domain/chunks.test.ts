import { describe, it, expect } from 'vitest'
import { resolveChunk, breakApart, isChunkItem } from './chunks'
import type { Chunk, ChunkSetItem } from './types'

const chunk = (items: Chunk['items']): Chunk => ({ id: 'c', title: 'C', items, notes: '', createdAt: '', updatedAt: '' })
const nums = new Map([
  ['a', { sec: 60, score: 8 }],
  ['b', { sec: 30, score: null }],
  ['c', { sec: 90, score: 6 }],
])

describe('resolveChunk', () => {
  it('sums only ticked jokes', () => {
    const r = resolveChunk(chunk([{ jokeId: 'a' }, { jokeId: 'b' }, { jokeId: 'c' }]), ['c'], nums)
    expect(r.sec).toBe(90)
    expect(r.score).toBe(8)
    expect(r.tickedCount).toBe(2)
    expect(r.entries).toHaveLength(3)
    expect(r.entries[2].ticked).toBe(false)
  })
  it('ignores jokes missing from the map', () => {
    const r = resolveChunk(chunk([{ jokeId: 'a' }, { jokeId: 'zzz' }]), undefined, nums)
    expect(r.entries.map(e => e.jokeId)).toEqual(['a'])
    expect(r.sec).toBe(60)
  })
  it('all skipped or empty gives zeros and null score', () => {
    const r = resolveChunk(chunk([{ jokeId: 'a' }, { jokeId: 'b' }]), ['a', 'b'], nums)
    expect(r).toMatchObject({ sec: 0, score: null, tickedCount: 0 })
    expect(resolveChunk(chunk([]), undefined, nums)).toEqual({ entries: [], sec: 0, score: null, tickedCount: 0 })
  })
  it('spokenSegue only when a later joke is ticked', () => {
    const c = chunk([{ jokeId: 'a', segue: 'sa' }, { jokeId: 'b', segue: 'sb' }, { jokeId: 'c', segue: 'sc' }])
    const r = resolveChunk(c, ['c'], nums)
    expect(r.entries.map(e => e.spokenSegue)).toEqual(['sa', undefined, undefined])
    const r2 = resolveChunk(c, ['b'], nums)
    expect(r2.entries.map(e => e.spokenSegue)).toEqual(['sa', undefined, undefined])
  })
})

describe('breakApart', () => {
  const item = (o: Partial<ChunkSetItem> = {}): ChunkSetItem => ({ id: 'x', kind: 'chunk', chunkId: 'c', ...o })
  const c = chunk([{ jokeId: 'a', segue: 'x' }, { jokeId: 'b' }, { jokeId: 'c' }])
  let n = 0
  const nid = () => 'n' + ++n
  it('copies ticked jokes with role and segue', () => {
    n = 0
    const { entries } = resolveChunk(c, ['c'], nums)
    expect(breakApart(item({ role: 'opener', segue: 'S' }), entries, new Set(), nid)).toEqual([
      { id: 'n1', kind: 'joke', jokeId: 'a', role: 'opener', segue: 'x' },
      { id: 'n2', kind: 'joke', jokeId: 'b', segue: 'S' },
    ])
  })
  it('closer lands on last; duplicates and skipped left out', () => {
    n = 0
    const { entries } = resolveChunk(c, ['c'], nums)
    expect(breakApart(item({ role: 'closer' }), entries, new Set(['a']), nid)).toEqual([
      { id: 'n1', kind: 'joke', jokeId: 'b', role: 'closer' },
    ])
  })
})

describe('isChunkItem', () => {
  it('only true for kind chunk', () => {
    expect(isChunkItem({ id: 'i', kind: 'chunk', chunkId: 'c' })).toBe(true)
    expect(isChunkItem({ id: 'i', kind: 'joke', jokeId: 'j' } as never)).toBe(false)
  })
})
