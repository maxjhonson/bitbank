import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getLastChangeAt, shouldShowBackupReminder } from '../../backup'
import { useSettings } from '../../db'
import { useT } from '../../i18n'
import { relativeTime } from '../../i18n/relative'
import { Button } from '../../ui/Button/Button'
import styles from './Backup.module.css'
import { useExportBackup } from './useExportBackup'

const KEY = 'bitbank.reminderDismissedAt'

function readDismissed(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function BackupBanner() {
  const t = useT()
  const settings = useSettings()
  const lastChangeAt = useLiveQuery(async () => (await getLastChangeAt()) ?? null, [])
  const [dismissedAt, setDismissedAt] = useState<string | undefined>(readDismissed)
  const exportNow = useExportBackup()

  if (lastChangeAt === undefined) return null
  const now = new Date()
  const show = shouldShowBackupReminder({
    lastExportAt: settings.lastExportAt,
    lastChangeAt: lastChangeAt ?? undefined,
    reminderDays: settings.backupReminderDays,
    dismissedAt,
    now,
  })
  if (!show) return null

  const dismiss = () => {
    const iso = new Date().toISOString()
    try {
      localStorage.setItem(KEY, iso)
    } catch {
      /* ignore */
    }
    setDismissedAt(iso)
  }

  return (
    <div className={styles.banner} role="region" aria-label={t('backup.exportBackup')}>
      <span>
        {settings.lastExportAt
          ? t('backup.bannerLast', { when: relativeTime(t, settings.lastExportAt, now.getTime()) })
          : t('backup.bannerNever')}
        {' · '}
      </span>
      <Button onClick={() => void exportNow()}>{t('backup.exportNow')}</Button>
      <Button variant="ghost" onClick={dismiss}>
        {t('backup.dismiss')}
      </Button>
    </div>
  )
}
