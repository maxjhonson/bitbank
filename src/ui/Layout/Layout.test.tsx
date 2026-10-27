import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useLang } from '../../i18n'
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

  function renderLayout(props: React.ComponentProps<typeof Layout>) {
    localStorage.setItem('bitbank.lang', 'es')
    return render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<Layout {...props} />}>
              <Route path="/x" element={<h1>Child</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
  }

  it('pinned tags container is a labelled group', () => {
    renderLayout({ pinnedTags: <a href="/?tag=a">#a</a> })
    expect(screen.getByRole('group', { name: /etiquetas/i })).toBeInTheDocument()
  })

  it('does not render the counts block when empty', () => {
    const { container } = renderLayout({})
    expect(container.querySelector('[data-slot="counts"]')).toBeNull()
  })

  it('footer is rendered and also reachable in the mobile top bar', () => {
    renderLayout({ footer: <span>Last backup X</span> })
    expect(screen.getByText('Last backup X')).toBeInTheDocument()
  })

  it('sets document.documentElement.lang from the current language, initially and on change', async () => {
    function Toggle() {
      const { setLang } = useLang()
      return <button onClick={() => setLang('en')}>to-en</button>
    }
    localStorage.setItem('bitbank.lang', 'es')
    render(<I18nProvider><Toggle /></I18nProvider>)
    expect(document.documentElement.lang).toBe('es')
    screen.getByText('to-en').click()
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
  })
})
