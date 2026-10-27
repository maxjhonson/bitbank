import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from './useAutosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAutosave', () => {
  it('saves once after 800 ms of inactivity', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender, result } = renderHook(({ v }) => useAutosave(v, save), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    rerender({ v: 'abc' })
    await act(async () => { await vi.advanceTimersByTimeAsync(799) })
    expect(save).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(2) })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abc')
    expect(result.current.status).toBe('saved')
    expect(result.current.savedAt).toBeInstanceOf(Date)
  })
  it('does not save an unchanged initial value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave('a', save))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(save).not.toHaveBeenCalled()
  })
  it('unmount before 800 ms still saves once', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = renderHook(({ v }) => useAutosave(v, save), { initialProps: { v: 'a' } })
    rerender({ v: 'b' })
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('b')
  })
  it('pagehide flushes pending save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ v }) => useAutosave(v, save), { initialProps: { v: 'a' } })
    rerender({ v: 'b' })
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('failed save sets status error and retries on next change', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined)
    const { rerender, result } = renderHook(({ v }) => useAutosave(v, save), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(result.current.status).toBe('error')
    rerender({ v: 'abc' })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(save).toHaveBeenLastCalledWith('abc')
    expect(result.current.status).toBe('saved')
  })

  it('flushes when the page becomes hidden', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ v }) => useAutosave(v, save), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    expect(save).toHaveBeenCalledWith('ab')
  })
})
