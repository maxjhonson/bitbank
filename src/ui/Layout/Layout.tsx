import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useT, type TKey } from '../../i18n'
import styles from './Layout.module.css'

const NAV: { to: string; key: TKey; end?: boolean }[] = [
  { to: '/', key: 'nav.library', end: true },
  { to: '/sets', key: 'nav.sets' },
  { to: '/notebook', key: 'nav.notebook' },
  { to: '/settings', key: 'nav.settings' },
]

interface LayoutProps {
  jokeCount?: ReactNode
  setCount?: ReactNode
  pinnedTags?: ReactNode
  footer?: ReactNode
  banner?: ReactNode
}

export function Layout({ jokeCount, setCount, pinnedTags, footer, banner }: LayoutProps) {
  const t = useT()
  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} no-print`}>
        <div className={styles.brand}>{t('app.name')}</div>
        <nav aria-label={t('nav.main')} className={styles.nav}>
          {NAV.map(({ to, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className={`${styles.counts} mono`}>
          {jokeCount && <div data-slot="joke-count">{jokeCount}</div>}
          {setCount && <div data-slot="set-count">{setCount}</div>}
        </div>
        {pinnedTags && (
          <div className={styles.pinned} aria-label={t('layout.pinnedTags')}>
            {pinnedTags}
          </div>
        )}
        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
      <main className={styles.main}>
        {banner && <div className="no-print">{banner}</div>}
        <Outlet />
      </main>
    </div>
  )
}
