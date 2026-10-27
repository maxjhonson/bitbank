import { relativeTime } from '../../i18n/relative'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getJoke, updateJoke, useJokeLookup, useJokes, usePerformances, useSettings } from '../../db'
import { jokeScore, jokeTime, scoreTrend } from '../../domain/derive'
import type { Joke } from '../../domain/types'
import { useT } from '../../i18n'
import { SidePanel } from './SidePanel'
import { TagLinesEditor } from './TagLinesEditor'
import { VersionHistory } from './VersionHistory'
import { useAutosave } from './useAutosave'
import { maybeSnapshot } from './versions'
import styles from './JokeEditorPage.module.css'

interface Draft {
  title: string
  premise: string
  setup: string
  punchline: string
  notes: string
  tagLines: Joke['tagLines']
}

const toDraft = (j: Joke): Draft => ({
  title: j.title, premise: j.premise, setup: j.setup, punchline: j.punchline, notes: j.notes, tagLines: j.tagLines,
})

export function JokeEditorPage() {
  const { id } = useParams()
  const t = useT()
  const joke = useJokeLookup(id)
  if (joke === undefined) return <p role="status">…</p>
  if (joke === null) {
    return (
      <div className={styles.notFound}>
        <h1>{t('editor.notFound')}</h1>
        <p>{t('editor.notFoundHelp')}</p>
        <Link to="/">{t('editor.backToLibrary')}</Link>
      </div>
    )
  }
  return <Editor key={joke.id} joke={joke} />
}

function SavedIndicator({ status, savedAt }: { status: 'idle' | 'saving' | 'saved'; savedAt?: Date }) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(h)
  }, [])
  let text = ''
  if (status === 'saving') text = t('editor.saving')
  else if (savedAt) text = t('editor.saved', { when: relativeTime(t, savedAt, Math.max(now, savedAt.getTime())) })
  return <p role="status" className={styles.saved}>{text}</p>
}

function Editor({ joke }: { joke: Joke }) {
  const t = useT()
  const location = useLocation()
  const settings = useSettings()
  const perfs = usePerformances(joke.id)
  const allJokes = useJokes()
  const [draft, setDraft] = useState<Draft>(() => toDraft(joke))
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusRequested = (location.state as { focusTitle?: boolean } | null)?.focusTitle
    if (focusRequested || joke.title === '') titleRef.current?.focus()
    // only on first mount of this joke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const autosave = useAutosave(draft, async d => {
    const prev = await getJoke(joke.id)
    if (!prev) return
    await updateJoke(joke.id, { ...d, versions: maybeSnapshot(prev, d, new Date()) })
  })

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))
  const { sec, source } = jokeTime(joke, perfs ?? [], settings.wordsPerMinute)
  const score = jokeScore(joke, perfs ?? [])
  const suggestions = useMemo(
    () => [...new Set((allJokes ?? []).flatMap(j => j.tags))].sort(),
    [allJokes],
  )

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.topBar}>
          <Link to="/">{t('editor.backToLibrary')}</Link>
          <SavedIndicator status={autosave.status} savedAt={autosave.savedAt} />
        </div>
        <label className={styles.field}>
          <span>{t('editor.title')}</span>
          <input ref={titleRef} className={`${styles.input} ${styles.titleInput}`} value={draft.title} onChange={e => set('title', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('editor.premise')}</span>
          <textarea className={styles.input} rows={2} value={draft.premise} onChange={e => set('premise', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('editor.setup')}</span>
          <textarea className={styles.input} rows={5} value={draft.setup} onChange={e => set('setup', e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.punch}`}>
          <span>{t('editor.punchline')}</span>
          <textarea className={styles.input} rows={3} value={draft.punchline} onChange={e => set('punchline', e.target.value)} />
        </label>
        <TagLinesEditor lines={draft.tagLines} onChange={l => set('tagLines', l)} />
        <label className={styles.field}>
          <span>{t('editor.notes')}</span>
          <textarea className={styles.input} rows={3} value={draft.notes} onChange={e => set('notes', e.target.value)} />
        </label>
        <VersionHistory
          versions={joke.versions}
          onRestore={v => setDraft(d => ({ ...d, setup: v.setup, punchline: v.punchline }))}
        />
      </div>
      <SidePanel
        sec={sec}
        source={source}
        score={score}
        trend={scoreTrend(perfs ?? [])}
        jokeId={joke.id}
        status={joke.status}
        tags={joke.tags}
        tagSuggestions={suggestions}
        onStatus={status => void updateJoke(joke.id, { status })}
        onTags={tags => void updateJoke(joke.id, { tags })}
      />
    </div>
  )
}
