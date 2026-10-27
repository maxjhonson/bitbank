import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock'

const nav = navigator as unknown as { wakeLock?: unknown }
afterEach(() => { delete nav.wakeLock })

describe('useWakeLock', () => {
  it('requests a lock when supported and releases on unmount', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() })
    nav.wakeLock = { request }
    const { result, unmount } = renderHook(() => useWakeLock(true))
    expect(result.current.supported).toBe(true)
    await waitFor(() => expect(result.current.held).toBe(true))
    expect(request).toHaveBeenCalledWith('screen')
    unmount()
    expect(release).toHaveBeenCalled()
  })

  it('does not throw when unsupported', () => {
    const { result } = renderHook(() => useWakeLock(true))
    expect(result.current).toEqual({ supported: false, held: false })
  })

  it('does not request when inactive', () => {
    const request = vi.fn()
    nav.wakeLock = { request }
    renderHook(() => useWakeLock(false))
    expect(request).not.toHaveBeenCalled()
  })

  it('swallows request rejection', async () => {
    nav.wakeLock = { request: vi.fn().mockRejectedValue(new Error('denied')) }
    const { result } = renderHook(() => useWakeLock(true))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.held).toBe(false)
  })

  it('does not issue a second request while the first is in flight', async () => {
    let resolve!: (v: unknown) => void
    const request = vi.fn().mockReturnValue(new Promise(r => { resolve = r }))
    nav.wakeLock = { request }
    renderHook(() => useWakeLock(true))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(request).toHaveBeenCalledTimes(1)
    resolve({ release: vi.fn().mockResolvedValue(undefined) })
  })
})
