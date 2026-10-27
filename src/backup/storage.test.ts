import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStorageStatus, requestPersistence } from './storage'

afterEach(() => vi.unstubAllGlobals())

describe('storage helpers', () => {
  it('reports status when supported', async () => {
    vi.stubGlobal('navigator', {
      storage: { persisted: async () => true, estimate: async () => ({ usage: 10, quota: 100 }) },
    })
    expect(await getStorageStatus()).toEqual({ persisted: true, usageBytes: 10, quotaBytes: 100 })
  })
  it('reports null when unsupported', async () => {
    vi.stubGlobal('navigator', {})
    expect(await getStorageStatus()).toEqual({ persisted: null })
    expect(await requestPersistence()).toBe(false)
  })
  it('requestPersistence returns the grant, and false on failure', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => true } })
    expect(await requestPersistence()).toBe(true)
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => false,
        persist: async () => {
          throw new Error('x')
        },
      },
    })
    expect(await requestPersistence()).toBe(false)
  })
})
