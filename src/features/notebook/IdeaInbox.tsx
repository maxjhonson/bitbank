import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { addIdea, deleteIdea, promoteIdea, useIdeas } from '../../db'
import { Button } from '../../ui/Button/Button'
import styles from './Notebook.module.css'

export function IdeaInbox() {
  const t = useT()
  const ideas = useIdeas()
  const [text, setText] = useState('')
  const sorted = [...(ideas ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    setText('')
    void addIdea(v)
  }

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
                <Button onClick={() => void promoteIdea(i.id)}>{t('notebook.promote')}</Button>
              )}
              <Button variant="danger" aria-label={`${t('notebook.delete')}: ${i.text}`} onClick={() => void deleteIdea(i.id)}>×</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
