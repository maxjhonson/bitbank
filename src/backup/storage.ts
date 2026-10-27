/** Asks the browser to protect our data from automatic cleanup. Never throws. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface StorageStatus {
  persisted: boolean | null
  usageBytes?: number
  quotaBytes?: number
}

/** `persisted` is null when the Storage API is unsupported. */
export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    const s = navigator.storage
    if (!s?.persisted) return { persisted: null }
    const persisted = await s.persisted()
    const est = s.estimate ? await s.estimate() : undefined
    return { persisted, usageBytes: est?.usage, quotaBytes: est?.quota }
  } catch {
    return { persisted: null }
  }
}
