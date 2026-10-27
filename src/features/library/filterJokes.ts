import type { Joke, JokeStatus } from '../../domain/types'

export interface LibraryItem {
  joke: Joke
  sec: number
  score: number | null
  source?: 'measured' | 'manual' | 'estimated'
  trend?: number | null
  runs: number
  usedIn: number
}

export interface LibraryQuery {
  text: string
  statuses: Set<JokeStatus>
  minScore7: boolean
  under60: boolean
  notInSet: boolean
  tag?: string
  sort: 'score' | 'time' | 'updated' | 'title'
}

function matchesText(j: Joke, needle: string): boolean {
  return [j.title, j.premise, j.setup, j.punchline, ...j.tags].some(s => s.toLowerCase().includes(needle))
}

export function filterAndSortJokes(items: LibraryItem[], q: LibraryQuery): LibraryItem[] {
  const needle = q.text.trim().toLowerCase()
  const out = items.filter(
    it =>
      (!needle || matchesText(it.joke, needle)) &&
      (q.statuses.size === 0 || q.statuses.has(it.joke.status)) &&
      (!q.minScore7 || (it.score !== null && it.score >= 7)) &&
      (!q.under60 || it.sec < 60) &&
      (!q.notInSet || it.usedIn === 0) &&
      (!q.tag || it.joke.tags.includes(q.tag)),
  )
  const byTitle = (a: LibraryItem, b: LibraryItem) => a.joke.title.localeCompare(b.joke.title)
  const cmp: Record<LibraryQuery['sort'], (a: LibraryItem, b: LibraryItem) => number> = {
    score: (a, b) =>
      a.score === b.score ? byTitle(a, b) : a.score === null ? 1 : b.score === null ? -1 : b.score - a.score,
    time: (a, b) => b.sec - a.sec || byTitle(a, b),
    updated: (a, b) => b.joke.updatedAt.localeCompare(a.joke.updatedAt),
    title: byTitle,
  }
  return out.sort(cmp[q.sort])
}
