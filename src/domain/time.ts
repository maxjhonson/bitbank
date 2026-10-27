export function formatMmSs(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const total = Math.round(Math.abs(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${sec < 0 && total > 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}

export function parseMmSs(text: string): number | null {
  const t = text.trim()
  let m = /^(\d+):([0-5]\d)$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = /^(\d+)$/.exec(t)
  if (m) return Number(m[1]) * 60
  return null
}
