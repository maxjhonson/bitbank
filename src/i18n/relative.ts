import type { TKey } from './en'

/** Relative time using the rel.* keys. */
export function relativeTime(
  t: (key: TKey, vars?: Record<string, string | number>) => string,
  from: Date | string,
  now: number = Date.now(),
): string {
  const f = typeof from === 'string' ? Date.parse(from) : from.getTime()
  const min = Math.floor((now - f) / 60000)
  if (min < 1) return t('rel.now')
  if (min < 60) return t('rel.minutes', { n: min })
  if (min < 1440) return t('rel.hours', { n: Math.floor(min / 60) })
  return t('rel.days', { n: Math.floor(min / 1440) })
}
