import { describe, expect, it } from 'vitest'
import type { Joke } from '../../domain/types'
import { maybeSnapshot } from './versions'

const NOW = new Date('2026-03-01T12:00:00Z')
const mk = (over: Partial<Joke> = {}): Joke => ({
  id: 'j', title: '', premise: '', setup: 'old setup', punchline: 'old punch', tagLines: [], notes: '',
  status: 'draft', tags: [], versions: [], createdAt: '', updatedAt: '', ...over,
})
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString()

describe('maybeSnapshot', () => {
  it('no snapshot when text unchanged', () => {
    expect(maybeSnapshot(mk(), { setup: 'old setup', punchline: 'old punch' }, NOW)).toEqual([])
  })
  it('snapshots previous text when changed and none exists', () => {
    const v = maybeSnapshot(mk(), { setup: 'new', punchline: 'old punch' }, NOW)
    expect(v).toEqual([{ savedAt: NOW.toISOString(), setup: 'old setup', punchline: 'old punch' }])
  })
  it('none when last snapshot is 30 minutes old', () => {
    const prev = mk({ versions: [{ savedAt: ago(30), setup: 'a', punchline: 'b' }] })
    expect(maybeSnapshot(prev, { setup: 'x', punchline: 'y' }, NOW)).toBe(prev.versions)
  })
  it('snapshots when last is 2 hours old', () => {
    const prev = mk({ versions: [{ savedAt: ago(120), setup: 'a', punchline: 'b' }] })
    const v = maybeSnapshot(prev, { setup: 'x', punchline: 'y' }, NOW)
    expect(v).toHaveLength(2)
    expect(v[1].setup).toBe('old setup')
  })
  it('caps at 20, dropping the oldest', () => {
    const versions = Array.from({ length: 20 }, (_, i) => ({ savedAt: ago(1000 + 20 - i), setup: `s${i}`, punchline: 'p' }))
    const v = maybeSnapshot(mk({ versions }), { setup: 'x', punchline: 'y' }, NOW)
    expect(v).toHaveLength(20)
    expect(v[0].setup).toBe('s1')
    expect(v[19].setup).toBe('old setup')
  })
})
