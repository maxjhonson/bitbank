import { isChunkItem } from '../../domain/chunks'
import { Link } from 'react-router-dom'
import { useChunks, useSets } from '../../db'
import { useT } from '../../i18n'
import styles from './SidePanel.module.css'

export function UsedIn({ jokeId }: { jokeId: string }) {
  const t = useT()
  const allSets = useSets() ?? []
  const chunks = (useChunks() ?? []).filter(c => c.items.some(i => i.jokeId === jokeId))
  const chunkIds = new Set(chunks.map(c => c.id))
  const direct = allSets.filter(s => s.items.some(i => !isChunkItem(i) && i.jokeId === jokeId))
  const viaChunk = allSets.filter(s =>
    s.items.some(i => isChunkItem(i) && chunkIds.has(i.chunkId) && !(i.skippedJokeIds ?? []).includes(jokeId)),
  )
  const groups = [
    { label: t('usedIn.direct'), links: direct.map(s => ({ id: s.id, to: `/sets/${s.id}`, name: s.name })) },
    { label: t('usedIn.chunks'), links: chunks.map(c => ({ id: c.id, to: `/chunks/${c.id}`, name: c.title || t('lib.untitled') })) },
    { label: t('usedIn.viaChunk'), links: viaChunk.map(s => ({ id: s.id, to: `/sets/${s.id}`, name: s.name })) },
  ].filter(g => g.links.length > 0)
  return (
    <div className={styles.field}>
      <span className={styles.label}>{t('usedIn')}</span>
      {groups.length === 0 ? (
        <span className={styles.source}>{t('usedIn.none')}</span>
      ) : (
        groups.map(g => (
          <div key={g.label}>
            <span className={styles.source}>{g.label}</span>
            <ul className={styles.links}>
              {g.links.map(l => <li key={l.id}><Link to={l.to}>{l.name}</Link></li>)}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
