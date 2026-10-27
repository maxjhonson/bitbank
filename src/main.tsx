import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { I18nProvider } from './i18n'
import { ToastProvider } from './ui/Toast/Toast'
import { requestPersistence } from './backup'
import './styles/tokens.css'
import './styles/global.css'

function shouldRequestPersistence(): boolean {
  try {
    if (localStorage.getItem('bitbank.persistRequested')) return false
    localStorage.setItem('bitbank.persistRequested', '1')
  } catch {
    /* storage unavailable: just ask */
  }
  return true
}

if (shouldRequestPersistence()) void requestPersistence().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
)
