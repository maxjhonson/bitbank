import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { addIdea, deleteIdea, promoteIdea, useIdeas } from '../../db'
import { useToast } from '../../ui/Toast/Toast'
import { Button } from '../../ui/Button/Button'
import styles from './Notebook.module.css'

export function IdeaInbox() {
  const t = useT()
  const ideas = useIdeas()
  const toast = useToast()
  const [text, setText] = useState('')
  const sorted = [...(ideas ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    addIdea(v).then(() => setText(''), () => toast(t('notebook.error')))
  }

  const run = (p: Promise<unknown>) => void p.catch(() => toast(t('notebook.error')))

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t('page.notebook')}</h1>
      <input
        className={styles.input}
        aria-label={t('notebook.captureLabel')}
        placeholder={t('notebook.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {ideas && ideas.length === 0 && <p className={styles.empty}>{t('notebook.empty')}</p>}
      <ul className={styles.list}>
        {sorted.map((i) => (
          <li key={i.id} className={styles.row}>
            <span className={styles.text}>{i.text}</span>
            <span className={styles.actions}>
              {i.promotedJokeId ? (
                <>
                  <span className={styles.badge}>{t('notebook.promoted')}</span>
                  <Link to={`/jokes/${i.promotedJokeId}`} className={styles.link}>{t('notebook.openJoke')}</Link>
                </>
              ) : (
                <Button onClick={() => run(promoteIdea(i.id))}>{t('notebook.promote')}</Button>
              )}
              <Button variant="danger" aria-label={`${t('notebook.delete')}: ${i.text}`} onClick={() => run(deleteIdea(i.id))}>×</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
