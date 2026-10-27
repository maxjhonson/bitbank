import { useSettings } from '../../db'
import { useT } from '../../i18n'
import { relativeTime } from '../../i18n/relative'
import { Button } from '../../ui/Button/Button'
import styles from './Backup.module.css'
import { useExportBackup } from './useExportBackup'

export function SidebarBackupFooter() {
  const t = useT()
  const { lastExportAt } = useSettings()
  const exportNow = useExportBackup()
  return (
    <div className={styles.footer}>
      <Button variant="ghost" onClick={() => void exportNow()}>
        {t('backup.exportBackup')}
      </Button>
      <p className={styles.footerText}>
        {lastExportAt ? t('backup.lastBackup', { when: relativeTime(t, lastExportAt) }) : t('backup.never')}
      </p>
    </div>
  )
}
