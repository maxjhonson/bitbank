import { Link } from 'react-router-dom'
import { useJokes, useSets } from '../../db'
import { useT } from '../../i18n'
import { Layout } from '../../ui/Layout/Layout'
import { BackupBanner } from '../backup/BackupBanner'
import { SidebarBackupFooter } from '../backup/SidebarBackupFooter'
import { Tag } from '../../ui/Tag/Tag'

/** Wires live counts and pinned tags (5 most-used) into the Layout sidebar. */
export function AppShell() {
  const t = useT()
  const jokes = useJokes()
  const sets = useSets()
  const freq = new Map<string, number>()
  for (const j of jokes ?? []) for (const tag of j.tags) freq.set(tag, (freq.get(tag) ?? 0) + 1)
  const pinned = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([tag]) => tag)
  return (
    <Layout
      banner={<BackupBanner />}
      footer={<SidebarBackupFooter />}
      jokeCount={jokes ? t('count.jokes', { n: jokes.length }) : undefined}
      setCount={sets ? t('count.sets', { n: sets.length }) : undefined}
      pinnedTags={
        pinned.length > 0
          ? pinned.map(tag => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`} style={{ textDecoration: 'none' }}>
                <Tag>{tag}</Tag>
              </Link>
            ))
          : undefined
      }
    />
  )
}
