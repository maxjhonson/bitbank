import { describe, expect, it } from 'vitest'
import { stageLines } from './stageLines'
import type { SetRow } from './useSetView'

const joke = (id: string, title: string, segue?: string) =>
  ({ kind: 'joke', itemId: `it-${id}`, joke: { id, title }, segue, sec: 0, score: null, slot: 1 }) as unknown as SetRow
const entry = (id: string, ticked: boolean, spokenSegue?: string) => ({ jokeId: id, ticked, spokenSegue, joke: { id, title: id.toUpperCase() }, sec: 0, score: null })
const chunk = (entries: ReturnType<typeof entry>[], segue?: string) =>
  ({ kind: 'chunk', itemId: 'c1', chunk: { id: 'ch', title: 'Airport' }, entries, segue, tickedCount: entries.filter(e => e.ticked).length, sec: 0, score: null, slot: 1 }) as unknown as SetRow

describe('stageLines', () => {
  it('keeps a joke row segue', () => {
    expect(stageLines([joke('a', 'Alpha', 'bridge')])).toEqual([{ key: 'it-a', title: 'Alpha', segue: 'bridge' }])
  })
  it('expands a chunk to ticked entries with spoken segues, marking the first line', () => {
    const lines = stageLines([chunk([entry('a', true, 'one'), entry('b', true), entry('c', true)])])
    expect(lines.map(l => [l.title, l.chunkTitle, l.segue, l.chunkStart])).toEqual([
      ['A', 'Airport', 'one', true],
      ['B', 'Airport', undefined, undefined],
      ['C', 'Airport', undefined, undefined],
    ])
  })
  it('drops the segue of a skipped joke', () => {
    const lines = stageLines([chunk([entry('a', true), entry('b', false), entry('c', true)])])
    expect(lines.map(l => l.title)).toEqual(['A', 'C'])
    expect(lines.every(l => l.segue === undefined)).toBe(true)
  })
  it('puts the item segue on the last ticked line', () => {
    const lines = stageLines([chunk([entry('a', true, 'one'), entry('b', true), entry('c', false)], 'out')])
    expect(lines.map(l => l.segue)).toEqual(['one', 'out'])
  })
  it('an all-skipped chunk yields nothing', () => {
    expect(stageLines([chunk([entry('a', false)], 'out')])).toEqual([])
  })
})
