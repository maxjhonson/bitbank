import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { Layout } from './Layout'

describe('Layout', () => {
  it('renders the four nav links and the child route', () => {
    localStorage.setItem('bitbank.lang', 'en')
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/x" element={<h1>Child page</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    for (const name of ['Library', 'Sets', 'Notebook', 'Settings']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Child page' })).toBeInTheDocument()
  })
})
