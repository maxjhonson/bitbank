import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJoke, db, updateSettings } from '../../db'
import { wipe } from '../../backup/helpers.test-util'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../../ui/Toast/Toast'
import { BackupBanner } from './BackupBanner'
import { SidebarBackupFooter } from './SidebarBackupFooter'

const downloads = vi.hoisted(() => ({ downloadText: vi.fn() }))
vi.mock('../../backup/download', () => downloads)

function wrap(ui: React.ReactNode) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  )
}

beforeEach(async () => {
  localStorage.setItem('bitbank.lang', 'en')
  downloads.downloadText.mockClear()
  await wipe()
})
afterEach(() => vi.useRealTimers())

describe('BackupBanner', () => {
  it('is hidden when there is nothing to protect', async () => {
    wrap(<BackupBanner />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Export now' })).not.toBeInTheDocument()
  })

  it('shows when stale and changed, and dismiss hides it and stores dismissal', async () => {
    await createJoke({ title: 'A' })
    const old = new Date(Date.now() - 12 * 86_400_000).toISOString()
    await updateSettings({ lastExportAt: old })
    // make the data newer than the export but only the export stale
    wrap(<BackupBanner />)
    expect(await screen.findByText(/Last backup 12 days ago/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss reminder' }))
    expect(screen.queryByText(/Last backup 12 days ago/)).not.toBeInTheDocument()
    expect(localStorage.getItem('bitbank.reminderDismissedAt')).toBeTruthy()
  })

  it('stays hidden when dismissed recently', async () => {
    await createJoke({ title: 'A' })
    localStorage.setItem('bitbank.reminderDismissedAt', new Date().toISOString())
    wrap(<BackupBanner />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Export now' })).not.toBeInTheDocument()
  })

  it('Export now downloads and hides the banner', async () => {
    await createJoke({ title: 'A' })
    wrap(<BackupBanner />)
    await userEvent.click(await screen.findByRole('button', { name: 'Export now' }))
    await waitFor(() => expect(downloads.downloadText).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Export now' })).not.toBeInTheDocument())
  })
})

describe('SidebarBackupFooter', () => {
  it('shows Never backed up', async () => {
    wrap(<SidebarBackupFooter />)
    expect(await screen.findByText('Never backed up')).toBeInTheDocument()
  })
  it('shows relative last backup and exports on click', async () => {
    await updateSettings({ lastExportAt: new Date(Date.now() - 3 * 3600_000).toISOString() })
    wrap(<SidebarBackupFooter />)
    expect(await screen.findByText('Last backup: 3 h ago')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }))
    await waitFor(() => expect(downloads.downloadText).toHaveBeenCalled())
    expect(await db.settings.count()).toBe(1)
  })
})

describe('export failure', () => {
  it('shows an error toast and downloads nothing when the export throws', async () => {
    await createJoke({ title: 'A' })
    const p = await db.jokes.toCollection().first()
    // an invalid performance makes exportJson fail its own validation
    await db.performances.add({ id: 'bad', jokeId: p!.id, date: '', venue: 'x', score: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
    wrap(<SidebarBackupFooter />)
    await userEvent.click(await screen.findByRole('button', { name: 'Export backup' }))
    expect(await screen.findByText('Export failed. Nothing was downloaded.')).toBeInTheDocument()
    expect(downloads.downloadText).not.toHaveBeenCalled()
  })
})
