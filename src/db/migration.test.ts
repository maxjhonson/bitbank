import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { upgradeToV2 } from './db'
import { SCHEMA_V1, SCHEMA_V2 } from './schema'

const NAME = 'bitbank-upgrade-test'

afterEach(async () => {
  await Dexie.delete(NAME)
})

describe('Dexie v1 -> v2 upgrade', () => {
  it('adds kind: joke to legacy set items and creates an empty chunks table', async () => {
    const old = new Dexie(NAME)
    old.version(1).stores(SCHEMA_V1)
    await old.open()
    await old.table('jokes').add({ id: 'j1', title: 'Old joke', updatedAt: '2026-10-01T00:00:00.000Z' })
    await old.table('sets').add({
      id: 's1', name: 'Old set', items: [{ id: 'i1', jokeId: 'j1' }, { id: 'i2', jokeId: 'j1', role: 'opener', segue: 'so' }],
      updatedAt: '2026-10-01T00:00:00.000Z',
    })
    old.close()

    const upgraded = new Dexie(NAME)
    upgraded.version(1).stores(SCHEMA_V1)
    upgraded.version(2).stores(SCHEMA_V2).upgrade(upgradeToV2)
    await upgraded.open()
    const set = await upgraded.table('sets').get('s1')
    expect(set.items).toEqual([
      { id: 'i1', kind: 'joke', jokeId: 'j1' },
      { id: 'i2', kind: 'joke', jokeId: 'j1', role: 'opener', segue: 'so' },
    ])
    expect(await upgraded.table('jokes').get('j1')).toMatchObject({ title: 'Old joke' })
    expect(await upgraded.table('chunks').toArray()).toEqual([])
    upgraded.close()
  })
})
