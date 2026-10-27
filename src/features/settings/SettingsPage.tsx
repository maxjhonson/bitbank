import { useEffect, useState } from 'react'
import { downloadText, exportMarkdown } from '../../backup'
import { updateSettings, useSettings } from '../../db'
import { useLang, useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import { useExportBackup } from '../backup/useExportBackup'
import { ImportPanel } from './ImportPanel'
import styles from './Settings.module.css'
import { StorageStatus } from './StorageStatus'

function NumberSetting({
  label,
  value,
  min,
  onCommit,
}: {
  label: string
  value: number
  min: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <label className={styles.field}>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isInteger(n) && n >= min) onCommit(n)
        }}
      />
    </label>
  )
}

export function SettingsPage() {
  const t = useT()
  const { lang, setLang } = useLang()
  const settings = useSettings()
  const exportBackup = useExportBackup()

  const exportMd = async () => {
    downloadText('bitbank-export.md', await exportMarkdown(), 'text/markdown')
  }

  return (
    <div className={styles.page}>
      <h1>{t('page.settings')}</h1>

      <StorageStatus />

      <section className={styles.section}>
        <h2>{t('settings.backup')}</h2>
        <div className={styles.row}>
          <Button onClick={() => void exportBackup()}>{t('backup.exportBackup')}</Button>
          <Button variant="ghost" onClick={() => void exportMd()}>
            {t('settings.exportMd')}
          </Button>
        </div>
      </section>

      <ImportPanel />

      <section className={styles.section}>
        <h2>{t('settings.prefs')}</h2>
        <NumberSetting
          label={t('settings.wpm')}
          value={settings.wordsPerMinute}
          min={1}
          onCommit={(n) => void updateSettings({ wordsPerMinute: n })}
        />
        <NumberSetting
          label={t('settings.reminderDays')}
          value={settings.backupReminderDays}
          min={1}
          onCommit={(n) => void updateSettings({ backupReminderDays: n })}
        />
        <label className={styles.field}>
          {t('settings.language')}
          <select value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'es')}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </section>
    </div>
  )
}
