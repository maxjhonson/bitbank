import { useCallback } from 'react'
import { downloadText, exportJson } from '../../backup'
import { useT } from '../../i18n'
import { useToast } from '../../ui/Toast/Toast'

/** Builds the backup (which stamps lastExportAt) and immediately triggers its download. */
export function useExportBackup(): () => Promise<void> {
  const t = useT()
  const toast = useToast()
  return useCallback(async () => {
    const { filename, json, counts } = await exportJson()
    downloadText(filename, json, 'application/json')
    toast(t('backup.exported', { jokes: counts.jokes, sets: counts.sets }))
  }, [t, toast])
}
