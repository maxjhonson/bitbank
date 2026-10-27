import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJoke, createSet, db, getSettings } from '../../db'
import { buildBackup } from '../../backup'
import { wipe } from '../../backup/helpers.test-util'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { SettingsPage } from './SettingsPage'

const downloads = vi.hoisted(() => ({ downloadText: vi.fn() }))
vi.mock('../../backup/download', () => downloads)

function setStorage(persisted: boolean | null) {
  vi.stubGlobal(
    'navigator',
    persisted === null
      ? { language: 'en' }
      : { language: 'en', storage: { persisted: async () => persisted, estimate: async () => ({ usage: 2048, quota: 1048576 }) } },
  )
}

function renderPage() {
  return render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  )
}

function fileOf(text: string, name = 'b.json') {
  return new File([text], name, { type: 'application/json' })
}

async function validBackupText() {
  const file = await buildBackup()
  return JSON.stringify(file)
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  downloads.downloadText.mockClear()
  setStorage(true)
  await wipe()
})
afterEach(() => vi.unstubAllGlobals())

describe('SettingsPage storage status', () => {
  it('shows protected', async () => {
    renderPage()
    expect(await screen.findByText('Protected from automatic cleanup')).toBeInTheDocument()
  })
  it('shows not protected with explanation', async () => {
    setStorage(false)
    renderPage()
    expect(await screen.findByText('Not protected')).toBeInTheDocument()
    expect(screen.getByText(/Home Screen.*clearing site data/)).toBeInTheDocument()
  })
})

describe('SettingsPage protect button', () => {
  function stubPersist(grant: boolean) {
    let persisted = false
    vi.stubGlobal('navigator', {
      language: 'en',
      storage: {
        persisted: async () => persisted,
        persist: async () => {
          persisted = grant
          return grant
        },
        estimate: async () => ({ usage: 1, quota: 2 }),
      },
    })
  }
  it('granted: switches to protected', async () => {
    stubPersist(true)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Protect my data' }))
    expect(await screen.findByText('Protected from automatic cleanup')).toBeInTheDocument()
  })
  it('denied: stays not protected', async () => {
    stubPersist(false)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Protect my data' }))
    await waitFor(() => expect(screen.getByText('Not protected')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Protect my data' })).toBeInTheDocument()
  })
})

describe('SettingsPage export', () => {
  it('downloads JSON, sets lastExportAt and toasts counts', async () => {
    await createJoke({ title: 'A' })
    await createJoke({ title: 'B' })
    await createSet({ name: 'S' })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }))
    await waitFor(() => expect(downloads.downloadText).toHaveBeenCalledTimes(1))
    const [filename, text, mime] = downloads.downloadText.mock.calls[0]
    expect(filename).toMatch(/^bitbank-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
    expect(JSON.parse(text).counts.jokes).toBe(2)
    expect(mime).toBe('application/json')
    expect((await getSettings()).lastExportAt).toBeTruthy()
    expect(await screen.findByText('Exported 2 jokes and 1 sets')).toBeInTheDocument()
  })
  it('exports markdown', async () => {
    await createJoke({ title: 'Zed' })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Export as Markdown' }))
    await waitFor(() => expect(downloads.downloadText).toHaveBeenCalled())
    const [filename, text, mime] = downloads.downloadText.mock.calls[0]
    expect(filename).toMatch(/\.md$/)
    expect(text).toContain('Zed')
    expect(mime).toBe('text/markdown')
    expect(await screen.findByText('Markdown exported')).toBeInTheDocument()
  })
})

describe('SettingsPage import', () => {
  it('invalid file shows errors and writes nothing', async () => {
    await createJoke({ title: 'Keep' })
    renderPage()
    await userEvent.upload(screen.getByLabelText('Choose backup file'), fileOf('not json'))
    expect(await screen.findByText('This file cannot be imported')).toBeInTheDocument()
    expect(screen.getByText('The file is not valid JSON.')).toBeInTheDocument()
    expect(await db.jokes.count()).toBe(1)
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument()
  })

  it('valid file shows preview, merge default, and merge result toast', async () => {
    await createJoke({ title: 'Local' })
    const text = await validBackupText()
    await wipe() // file now has 1 joke that is new locally
    renderPage()
    await userEvent.upload(screen.getByLabelText('Choose backup file'), fileOf(text))
    expect(await screen.findByText(/1 new/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Merge/)).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText(/1 added, 0 updated, 0 skipped, 0 dangling removed/)).toBeInTheDocument()
    expect(await db.jokes.count()).toBe(1)
    expect(downloads.downloadText).not.toHaveBeenCalled()
  })

  it('replace requires REPLACE, auto-exports current data first, then replaces', async () => {
    await createJoke({ title: 'FromFile' })
    const text = await validBackupText()
    await wipe()
    await createJoke({ title: 'Current1' })
    await createJoke({ title: 'Current2' })
    renderPage()
    await userEvent.upload(screen.getByLabelText('Choose backup file'), fileOf(text))
    await screen.findByText(/1 new/)
    await userEvent.click(screen.getByLabelText('Replace all'))
    const run = screen.getByRole('button', { name: 'Import' })
    expect(run).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Type REPLACE to confirm'), 'replace')
    expect(run).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Type REPLACE to confirm'))
    await userEvent.type(screen.getByLabelText('Type REPLACE to confirm'), 'REPLACE')
    expect(run).toBeEnabled()
    await userEvent.click(run)
    await waitFor(() => expect(downloads.downloadText).toHaveBeenCalledTimes(1))
    expect(JSON.parse(downloads.downloadText.mock.calls[0][1]).counts.jokes).toBe(2)
    await screen.findByText(/Import done/)
    const titles = (await db.jokes.toArray()).map((j) => j.title)
    expect(titles).toEqual(['FromFile'])
  })

  it('shows an error when the file cannot be read and writes nothing', async () => {
    class BadReader {
      onerror: (() => void) | null = null
      error = new Error('boom')
      readAsText() {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal('FileReader', BadReader)
    renderPage()
    await userEvent.upload(screen.getByLabelText('Choose backup file'), fileOf('{}'))
    expect(await screen.findByText('Could not read this file.')).toBeInTheDocument()
    expect(await db.jokes.count()).toBe(0)
  })

  it('replace: if the automatic export fails, nothing is replaced and an error toast shows', async () => {
    await createJoke({ title: 'FromFile' })
    const text = await validBackupText()
    await wipe()
    await createJoke({ title: 'Current' })
    downloads.downloadText.mockImplementationOnce(() => {
      throw new Error('blocked')
    })
    renderPage()
    await userEvent.upload(screen.getByLabelText('Choose backup file'), fileOf(text))
    await screen.findByText(/1 new/)
    await userEvent.click(screen.getByLabelText('Replace all'))
    await userEvent.type(screen.getByLabelText('Type REPLACE to confirm'), 'REPLACE')
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('Import failed. Nothing was changed.')).toBeInTheDocument()
    expect((await db.jokes.toArray()).map((j) => j.title)).toEqual(['Current'])
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('accepts a dropped file like the picker', async () => {
    const text = await validBackupText()
    renderPage()
    const zone = screen.getByText('or drop a backup file here')
    fireEvent.drop(zone, { dataTransfer: { files: [fileOf(text)] } })
    expect(await screen.findByText('Preview')).toBeInTheDocument()
  })
})

describe('SettingsPage preferences', () => {
  it('persists words per minute and reminder days', async () => {
    renderPage()
    const wpm = screen.getByLabelText('Words per minute')
    await userEvent.clear(wpm)
    await userEvent.type(wpm, '180')
    const days = screen.getByLabelText('Backup reminder (days)')
    await userEvent.clear(days)
    await userEvent.type(days, '14')
    await waitFor(async () => {
      const s = await getSettings()
      expect(s.wordsPerMinute).toBe(180)
      expect(s.backupReminderDays).toBe(14)
    })
  })
  it('switches language', async () => {
    renderPage()
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'es')
    expect(await screen.findByText('Preferencias')).toBeInTheDocument()
  })
})
