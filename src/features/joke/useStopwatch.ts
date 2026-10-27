import { useCallback, useEffect, useRef, useState } from 'react'

export function useStopwatch(): { elapsedSec: number; running: boolean; start(): void; stop(): number; reset(): void } {
  const [elapsedSec, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startedAt = useRef(0)
  const base = useRef(0)

  useEffect(() => {
    if (!running) return
    const h = setInterval(() => {
      setElapsed(base.current + Math.floor((Date.now() - startedAt.current) / 1000))
    }, 250)
    return () => clearInterval(h)
  }, [running])

  const start = useCallback(() => {
    startedAt.current = Date.now()
    setRunning(true)
  }, [])
  const stop = useCallback(() => {
    const total = running ? base.current + Math.floor((Date.now() - startedAt.current) / 1000) : base.current
    base.current = total
    setElapsed(total)
    setRunning(false)
    return total
  }, [running])
  const reset = useCallback(() => {
    base.current = 0
    setElapsed(0)
    setRunning(false)
  }, [])
  return { elapsedSec, running, start, stop, reset }
}
