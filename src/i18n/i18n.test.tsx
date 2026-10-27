import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider, useLang, useT } from './index'

function Probe() {
  const t = useT()
  const { lang, setLang } = useLang()
  return (
    <div>
      <p data-testid="lang">{lang}</p>
      <p data-testid="nav">{t('nav.library')}</p>
      <p data-testid="count">{t('count.jokes', { n: 3 })}</p>
      <button onClick={() => setLang('es')}>es</button>
    </div>
  )
}

describe('i18n', () => {
  it('returns Spanish after setLang(es), interpolates {n}, and persists', () => {
    localStorage.setItem('bitbank.lang', 'en')
    render(<I18nProvider><Probe /></I18nProvider>)
    expect(screen.getByTestId('nav')).toHaveTextContent('Library')
    expect(screen.getByTestId('count')).toHaveTextContent('3 jokes')
    act(() => screen.getByText('es').click())
    expect(screen.getByTestId('nav')).toHaveTextContent('Biblioteca')
    expect(screen.getByTestId('count')).toHaveTextContent('3 chistes')
    expect(localStorage.getItem('bitbank.lang')).toBe('es')
  })

  it('defaults from navigator.language', () => {
    Object.defineProperty(navigator, 'language', { value: 'es-MX', configurable: true })
    render(<I18nProvider><Probe /></I18nProvider>)
    expect(screen.getByTestId('lang')).toHaveTextContent('es')
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true })
  })
})
