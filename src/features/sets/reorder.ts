/** Returns a new array with the item at `from` moved to `to` (clamped). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const out = items.slice()
  if (!Number.isInteger(from) || from < 0 || from >= out.length) return out
  const target = Math.max(0, Math.min(out.length - 1, to))
  const [it] = out.splice(from, 1)
  out.splice(target, 0, it)
  return out
}
