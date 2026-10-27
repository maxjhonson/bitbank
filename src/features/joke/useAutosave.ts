import { useCallback, useEffect, useRef, useState } from 'react'

export interface Autosave {
  status: 'idle' | 'saving' | 'saved' | 'error'
  savedAt?: Date
  flush(): Promise<void>
}

/**
 * Debounced autosave. The initial value is treated as already saved.
 * Pending changes are flushed on unmount, `pagehide` and when the page becomes hidden.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, delayMs = 800): Autosave {
  const [status, setStatus] = useState<Autosave['status']>('idle')
  const [savedAt, setSavedAt] = useState<Date>()
  const latest = useRef(value)
  const saved = useRef(value)
  const saveRef = useRef(save)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const chain = useRef<Promise<void>>(Promise.resolve())
  const mounted = useRef(true)
  latest.current = value
  saveRef.current = save

  const flush = useCallback((): Promise<void> => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current)
      timer.current = undefined
    }
    if (latest.current === saved.current) return chain.current
    const v = latest.current
    saved.current = v
    if (mounted.current) setStatus('saving')
    chain.current = chain.current
      .then(() => saveRef.current(v))
      .then(
        () => {
          if (mounted.current) {
            setStatus('saved')
            setSavedAt(new Date())
          }
        },
        () => {
          // allow a retry on the next change
          if (saved.current === v) saved.current = undefined as unknown as T
          if (mounted.current) setStatus('error')
        },
      )
    return chain.current
  }, [])

  useEffect(() => {
    if (value === saved.current) return
    timer.current = setTimeout(() => void flush(), delayMs)
    return () => {
      if (timer.current !== undefined) clearTimeout(timer.current)
    }
  }, [value, delayMs, flush])

  useEffect(() => {
    mounted.current = true
    const onHide = () => void flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      void flush()
      mounted.current = false
    }
  }, [flush])

  return { status, savedAt, flush }
}
