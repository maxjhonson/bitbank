import { REHEARSAL_VENUE, type ComedySet, type Joke, type Performance } from './types'

export type TimeSource = 'measured' | 'manual' | 'estimated'

const DEFAULT_WPM = 150

function real(perfs: Performance[]): Performance[] {
  return perfs
    .filter(p => p.venue !== REHEARSAL_VENUE)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function jokeTime(joke: Joke, perfs: Performance[], wpm: number): { sec: number; source: TimeSource } {
  if (joke.manualTimeSec !== undefined && joke.manualTimeSec !== null) {
    return { sec: joke.manualTimeSec, source: 'manual' }
  }
  const durs = real(perfs).flatMap(p => (p.durationSec === undefined || p.durationSec === null ? [] : [p.durationSec]))
  if (durs.length > 0) return { sec: Math.round(mean(durs)), source: 'measured' }
  const text = [joke.setup, joke.punchline, ...joke.tagLines.map(t => t.text)].join(' ')
  const words = text.split(/\s+/).filter(Boolean).length
  const rate = Number.isFinite(wpm) && wpm > 0 ? wpm : DEFAULT_WPM
  return { sec: Math.round((words / rate) * 60), source: 'estimated' }
}

export function jokeScore(joke: Joke, perfs: Performance[]): number | null {
  const last = real(perfs).slice(-5)
  if (last.length > 0) return Math.round(mean(last.map(p => p.score)) * 10) / 10
  return joke.manualScore ?? null
}

export function scoreTrend(perfs: Performance[]): number | null {
  const all = real(perfs)
  if (all.length < 6) return null
  const last = all.slice(-5)
  const prior = all.slice(Math.max(0, all.length - 10), all.length - 5)
  return mean(last.map(p => p.score)) - mean(prior.map(p => p.score))
}

export function runCount(perfs: Performance[]): number {
  return real(perfs).length
}

export interface ResolvedItem {
  itemId: string
  sec: number
  score: number | null
  jokeScores: (number | null)[]
}

export function setTotals(
  set: Pick<ComedySet, 'targetSec' | 'bufferSec'>,
  items: ResolvedItem[],
): { jokesSec: number; totalSec: number; remainingSec: number; avgScore: number | null; untestedCount: number; over: boolean } {
  let jokesSec = 0
  let untestedCount = 0
  const scores: number[] = []
  for (const item of items) {
    jokesSec += item.sec
    if (item.jokeScores.length === 0) untestedCount++
    for (const s of item.jokeScores) {
      if (s === null) untestedCount++
      else scores.push(s)
    }
  }
  const totalSec = jokesSec + set.bufferSec
  return {
    jokesSec,
    totalSec,
    remainingSec: set.targetSec - totalSec,
    avgScore: scores.length ? mean(scores) : null,
    untestedCount,
    over: totalSec > set.targetSec,
  }
}

export function weakSpots(items: ResolvedItem[]): string[] {
  const n = items.length
  if (n < 3) return []
  const scored = items.flatMap(i => (i.score === null ? [] : [i.score]))
  if (scored.length === 0) return []
  const threshold = mean(scored) - 1.5
  const out: string[] = []
  for (let i = 1; i <= n - 2; i++) {
    const s = items[i].score
    if (s !== null && s <= threshold + 1e-9) out.push(items[i].itemId)
  }
  return out
}
