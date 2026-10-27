import { useEffect, useState } from 'react'
import { getStorageStatus, requestPersistence, type StorageStatus as Status } from '../../backup'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import styles from './Settings.module.css'

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function StorageStatus() {
  const t = useT()
  const [status, setStatus] = useState<Status | null>(null)
  useEffect(() => {
    let live = true
    void getStorageStatus().then((s) => live && setStatus(s))
    return () => {
      live = false
    }
  }, [])
  if (!status) return null
  return (
    <section className={styles.section}>
      <h2>{t('settings.storage')}</h2>
      {status.persisted === null ? (
        <p>{t('settings.storageUnknown')}</p>
      ) : status.persisted ? (
        <p>{t('settings.protected')}</p>
      ) : (
        <>
          <p>{t('settings.notProtected')}</p>
          <p className={styles.help}>{t('settings.notProtectedHelp')}</p>
          <div>
            <Button
              onClick={() => {
                void requestPersistence().then(() => getStorageStatus()).then(setStatus)
              }}
            >
              {t('settings.protect')}
            </Button>
          </div>
        </>
      )}
      {status.usageBytes !== undefined && status.quotaBytes !== undefined && (
        <p className={styles.help}>
          {t('settings.usage', { used: fmt(status.usageBytes), quota: fmt(status.quotaBytes) })}
        </p>
      )}
    </section>
  )
}
