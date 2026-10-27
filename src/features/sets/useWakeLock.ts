import { useEffect, useState } from 'react'

interface Sentinel { release(): Promise<void>; addEventListener?(t: string, cb: () => void): void }
interface WakeLockApi { request(type: 'screen'): Promise<Sentinel> }

const api = (): WakeLockApi | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock

/** Keeps the screen awake while active. Silently no-ops when unsupported. */
export function useWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const supported = !!api()
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const wl = api()
    if (!active || !wl) return
    let sentinel: Sentinel | null = null
    let cancelled = false
    let inFlight = false
    const acquire = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const s = await wl.request('screen')
        if (cancelled) { void s.release().catch(() => {}); return }
        sentinel = s
        s.addEventListener?.('release', () => { if (sentinel === s) { sentinel = null; setHeld(false) } })
        setHeld(true)
      } catch { setHeld(false) } finally { inFlight = false }
    }
    const onVisible = () => { if (document.visibilityState === 'visible' && !sentinel) void acquire() }
    document.addEventListener('visibilitychange', onVisible)
    void acquire()
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      const s = sentinel
      sentinel = null
      if (s) void s.release().catch(() => {})
      setHeld(false)
    }
  }, [active])
  return { supported, held }
}
