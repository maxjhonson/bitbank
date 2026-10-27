export type JokeStatus = 'draft' | 'working' | 'tight' | 'retired'

export interface Joke {
  id: string
  title: string
  premise: string
  setup: string
  punchline: string
  tagLines: { id: string; text: string; kind: 'tag' | 'act-out' }[]
  notes: string // private notes
  status: JokeStatus
  tags: string[] // lowercase, no '#', e.g. 'family'
  manualTimeSec?: number // optional override
  manualScore?: number // 0-10, used until a performance is logged
  versions: { savedAt: string; setup: string; punchline: string }[]
  createdAt: string
  updatedAt: string
}

export interface Performance {
  id: string
  jokeId: string
  date: string // YYYY-MM-DD
  venue: string
  durationSec?: number
  score: number // 0-10, one decimal
  note?: string
  createdAt: string
  updatedAt: string
}

export interface ComedySet {
  id: string
  name: string
  date?: string
  venue?: string
  targetSec: number // e.g. 900 for 15:00
  bufferSec: number // segues and crowd work, default 60
  items: { id: string; jokeId: string; role?: 'opener' | 'closer'; segue?: string }[]
  createdAt: string
  updatedAt: string
}

export interface Idea {
  id: string
  text: string
  createdAt: string
  updatedAt: string
  promotedJokeId?: string
}

export interface Settings {
  id: 'settings'
  wordsPerMinute: number // default 150, for time estimates
  lastExportAt?: string
  backupReminderDays: number // default 7
}

export const REHEARSAL_VENUE = 'Rehearsal'
