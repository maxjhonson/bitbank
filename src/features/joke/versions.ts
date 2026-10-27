import type { Joke } from '../../domain/types'

const HOUR_MS = 60 * 60 * 1000
const MAX_VERSIONS = 20

/**
 * Appends a snapshot of the PREVIOUS setup/punchline when either changed and the
 * last snapshot is more than an hour old (or none exists). Keeps the last 20.
 */
export function maybeSnapshot(
  prev: Joke,
  next: { setup: string; punchline: string },
  now: Date,
): Joke['versions'] {
  const changed = prev.setup !== next.setup || prev.punchline !== next.punchline
  if (!changed) return prev.versions
  if (prev.setup.trim() === '' && prev.punchline.trim() === '') return prev.versions
  const last = prev.versions[prev.versions.length - 1]
  if (last) {
    const age = now.getTime() - new Date(last.savedAt).getTime()
    if (Number.isFinite(age) && age <= HOUR_MS) return prev.versions
  }
  const entry = { savedAt: now.toISOString(), setup: prev.setup, punchline: prev.punchline }
  return [...prev.versions, entry].slice(-MAX_VERSIONS)
}

/** Unconditionally appends a snapshot of the given text (bypasses the 1-hour rule); skipped when both parts are empty. */
export function forceSnapshot(
  versions: Joke['versions'],
  current: { setup: string; punchline: string },
  now: Date,
): Joke['versions'] {
  if (current.setup.trim() === '' && current.punchline.trim() === '') return versions
  const entry = { savedAt: now.toISOString(), setup: current.setup, punchline: current.punchline }
  return [...versions, entry].slice(-MAX_VERSIONS)
}
