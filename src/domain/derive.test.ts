import { describe, it, expect } from 'vitest'
import { jokeTime, jokeScore, scoreTrend, runCount, setTotals, weakSpots } from './derive'
import { REHEARSAL_VENUE, type ComedySet, type Joke, type Performance } from './types'

const joke = (o: Partial<Joke> = {}): Joke => ({
  id: 'j1', title: 't', premise: '', setup: '', punchline: '', tagLines: [], notes: '',
  status: 'draft', tags: [], versions: [], createdAt: '', updatedAt: '', ...o,
})
let n = 0
const perf = (score: number, o: Partial<Performance> = {}): Performance => {
  n++
  return {
    id: 'p' + n, jokeId: 'j1', date: `2026-01-${String(n).padStart(2, '0')}`, venue: 'Club',
    score, createdAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}`, updatedAt: '', ...o,
  }
}
const set = (ids: string[], o: Partial<ComedySet> = {}): ComedySet => ({
  id: 's', name: 's', targetSec: 900, bufferSec: 60,
  items: ids.map((j, i) => ({ id: 'i' + i, jokeId: j })), createdAt: '', updatedAt: '', ...o,
})

describe('Joke time', () => {
  it('empty joke is estimated 0', () => {
    expect(jokeTime(joke(), [], 150)).toEqual({ sec: 0, source: 'estimated' })
  })
  it('estimates from words incl. tag lines', () => {
    const j = joke({ setup: 'a b c', punchline: 'd e', tagLines: [{ id: 't', text: 'f g h i', kind: 'tag' }] })
    expect(jokeTime(j, [], 9)).toEqual({ sec: 60, source: 'estimated' })
  })
  it('wpm 0 or NaN falls back to 150', () => {
    const j = joke({ setup: Array(150).fill('w').join(' ') })
    expect(jokeTime(j, [], 0).sec).toBe(60)
    expect(jokeTime(j, [], NaN).sec).toBe(60)
  })
  it('single performance measured', () => {
    expect(jokeTime(joke(), [perf(5, { durationSec: 42 })], 150)).toEqual({ sec: 42, source: 'measured' })
  })
  it('mean of durations, ignoring those without', () => {
    const ps = [perf(5, { durationSec: 40 }), perf(5), perf(5, { durationSec: 45 })]
    expect(jokeTime(joke(), ps, 150)).toEqual({ sec: 43, source: 'measured' })
  })
  it('manual 0 wins', () => {
    expect(jokeTime(joke({ manualTimeSec: 0 }), [perf(5, { durationSec: 40 })], 150)).toEqual({ sec: 0, source: 'manual' })
  })
  it('rehearsal excluded', () => {
    const ps = [perf(5, { durationSec: 40, venue: REHEARSAL_VENUE })]
    expect(jokeTime(joke({ setup: 'a' }), ps, 60).source).toBe('estimated')
  })
})

describe('Joke score', () => {
  it('null when nothing', () => expect(jokeScore(joke(), [])).toBeNull())
  it('manual fallback', () => expect(jokeScore(joke({ manualScore: 6 }), [])).toBe(6))
  it('rehearsal excluded -> manual', () => {
    expect(jokeScore(joke({ manualScore: 6 }), [perf(9, { venue: REHEARSAL_VENUE })])).toBe(6)
  })
  it('rounds to one decimal', () => {
    expect(jokeScore(joke(), [perf(7), perf(7), perf(8)])).toBe(7.3)
  })
  it('uses last 5 by date', () => {
    const ps = [perf(0), perf(10), perf(10), perf(10), perf(10), perf(10)]
    expect(jokeScore(joke(), ps)).toBe(10)
  })
  it('sorts by date then createdAt', () => {
    const a = perf(10, { date: '2026-02-01', createdAt: 'b' })
    const b = perf(0, { date: '2026-02-01', createdAt: 'a' })
    const old = [1, 2, 3, 4].map(() => perf(4, { date: '2025-01-01' }))
    expect(jokeScore(joke(), [a, b, ...old])).toBe(4.4) // last5 = 4,4,4,0,10
  })
})

describe('Score trend', () => {
  it('null at 5, defined at 6', () => {
    const five = [1, 2, 3, 4, 5].map(s => perf(s))
    expect(scoreTrend(five)).toBeNull()
    expect(scoreTrend([...five, perf(6)])).toBe(4 - 1) // last5 = 2..6 mean 4; prior [1] mean 1
  })
  it('excludes rehearsal', () => {
    const ps = [1, 2, 3, 4, 5].map(s => perf(s))
    ps.push(perf(9, { venue: REHEARSAL_VENUE }))
    expect(scoreTrend(ps)).toBeNull()
  })
})

describe('Runs', () => {
  it('counts non-rehearsal', () => {
    expect(runCount([perf(1), perf(1), perf(1, { venue: REHEARSAL_VENUE })])).toBe(2)
  })
})

describe('Set total', () => {
  it('zero items', () => {
    expect(setTotals(set([]), new Map())).toEqual({ jokesSec: 0, totalSec: 60, remainingSec: 840, avgScore: null, untestedCount: 0, over: false })
  })
  it('sums, skips missing, counts untested, over', () => {
    const m = new Map([['a', { sec: 500, score: 8 }], ['b', { sec: 400, score: null }]])
    const t = setTotals(set(['a', 'b', 'zzz']), m)
    expect(t).toEqual({ jokesSec: 900, totalSec: 960, remainingSec: -60, avgScore: 8, untestedCount: 1, over: true })
  })
  it('not over when equal', () => {
    const m = new Map([['a', { sec: 840, score: 5 }]])
    expect(setTotals(set(['a']), m).over).toBe(false)
  })
})

describe('Weak spot', () => {
  const sc = (...v: (number | null)[]) => new Map(v.map((x, i) => ['j' + i, x] as [string, number | null]))
  const s = (k: number) => set(Array.from({ length: k }, (_, i) => 'j' + i))
  it('exactly 1.5 below average is flagged', () => {
    expect(weakSpots(s(3), sc(10, 7.75, 10))).toEqual(['i1'])
  })
  it('1.4 below average is not flagged', () => {
    expect(weakSpots(s(3), sc(10, 7.85, 10))).toEqual([])
  })
  it('first/last never flagged', () => {
    expect(weakSpots(s(3), sc(1, 9, 9))).toEqual([])
    expect(weakSpots(s(3), sc(9, 9, 1))).toEqual([])
  })
  it('none when n<3', () => expect(weakSpots(s(2), sc(1, 9))).toEqual([]))
  it('null score not flagged', () => expect(weakSpots(s(3), sc(9, null, 9))).toEqual([]))
})
