import { describe, expect, it } from 'vitest'
import { moveItem } from './reorder'

describe('moveItem', () => {
  const a = ['a', 'b', 'c', 'd']
  it('moves forward', () => expect(moveItem(a, 0, 2)).toEqual(['b', 'c', 'a', 'd']))
  it('moves backward', () => expect(moveItem(a, 3, 1)).toEqual(['a', 'd', 'b', 'c']))
  it('same index returns equal copy', () => {
    const r = moveItem(a, 1, 1)
    expect(r).toEqual(a)
    expect(r).not.toBe(a)
  })
  it('clamps out-of-range target', () => {
    expect(moveItem(a, 0, 99)).toEqual(['b', 'c', 'd', 'a'])
    expect(moveItem(a, 3, -5)).toEqual(['d', 'a', 'b', 'c'])
  })
  it('out-of-range source is a no-op', () => {
    expect(moveItem(a, 9, 0)).toEqual(a)
    expect(moveItem([], 0, 0)).toEqual([])
  })
  it('does not mutate input', () => {
    moveItem(a, 0, 3)
    expect(a).toEqual(['a', 'b', 'c', 'd'])
  })
})
