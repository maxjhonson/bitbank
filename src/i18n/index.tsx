import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { en, type TKey } from './en'
import { es } from './es'

export type Lang = 'en' | 'es'
export type { TKey }
const STORAGE_KEY = 'bitbank.lang'
const dicts: Record<Lang, Record<TKey, string>> = { en, es }

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
}
const LangContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l
  }, [])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside I18nProvider')
  return ctx
}

export function useT(): (key: TKey, vars?: Record<string, string | number>) => string {
  const { lang } = useLang()
  return useCallback(
    (key, vars) => {
      const s = dicts[lang][key] ?? en[key]
      return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
    },
    [lang],
  )
}
