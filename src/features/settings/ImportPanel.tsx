import { useRef, useState, type DragEvent } from 'react'
import {
  applyImport,
  downloadText,
  exportJson,
  parseBackup,
  previewImport,
  type BackupFile,
  type ImportPreview,
} from '../../backup'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button/Button'
import { useToast } from '../../ui/Toast/Toast'
import styles from './Settings.module.css'

const TABLES = ['jokes', 'performances', 'sets', 'ideas', 'chunks'] as const

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

export function ImportPanel() {
  const t = useT()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [file, setFile] = useState<BackupFile | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setErrors([])
    setFile(null)
    setPreview(null)
    setMode('merge')
    setConfirm('')
  }

  const load = async (f: File | undefined) => {
    reset()
    if (!f) return
    try {
      const parsed = parseBackup(await readText(f))
      if (!parsed.ok) {
        setErrors(parsed.errors)
        return
      }
      const pv = await previewImport(parsed.file)
      setFile(parsed.file)
      setPreview(pv)
    } catch {
      setErrors([t('import.readError')])
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    void load(e.dataTransfer.files[0])
  }

  const run = async () => {
    if (!file) return
    setBusy(true)
    try {
      if (mode === 'replace') {
        // Safety net: download the current data before it is erased.
        const { filename, json } = await exportJson()
        downloadText(filename, json, 'application/json')
      }
      const r = await applyImport(file, mode)
      toast(t('import.done', { added: r.added, updated: r.updated, skipped: r.skipped, removed: r.removedDangling }))
      reset()
      if (inputRef.current) inputRef.current.value = ''
    } catch {
      toast(t('import.failed'))
    } finally {
      setBusy(false)
    }
  }

  const canRun = !!file && !busy && (mode === 'merge' || confirm === 'REPLACE')

  return (
    <section className={styles.section}>
      <h2>{t('import.title')}</h2>
      <div className={styles.drop} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <label>
          {t('import.choose')}
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void load(e.target.files?.[0])}
          />
        </label>
        <p className={styles.help}>{t('import.drop')}</p>
      </div>

      {errors.length > 0 && (
        <div role="alert">
          <p>{t('import.errors')}</p>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && file && (
        <div>
          <h3>{t('import.preview')}</h3>
          <ul className={styles.previewList}>
            {TABLES.map((tb) => {
              const c = preview[tb]
              return (
                <li key={tb}>
                  <strong>{t(`import.table.${tb}`)}</strong>: {t('import.inFile', { n: c.inFile })},{' '}
                  {t('import.new', { n: c.new })}, {t('import.newer', { n: c.newer })},{' '}
                  {t('import.older', { n: c.older })}, {t('import.identical', { n: c.identical })}
                </li>
              )
            })}
          </ul>
          <label className={styles.radio}>
            <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            {t('import.merge')}
          </label>
          <label className={styles.radio}>
            <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            {t('import.replace')}
          </label>
          {mode === 'replace' && (
            <div>
              <p className={styles.help}>{t('import.replaceWarn')}</p>
              <label>
                {t('import.confirmLabel')}
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              </label>
            </div>
          )}
          <Button variant={mode === 'replace' ? 'danger' : 'primary'} disabled={!canRun} onClick={() => void run()}>
            {t('import.run')}
          </Button>
        </div>
      )}
    </section>
  )
}
