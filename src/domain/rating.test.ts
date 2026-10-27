import { describe, expect, it } from 'vitest'
import { ratingToScore, scoreToRating } from './rating'

describe('rating', () => {
  it('round-trips 1-5', () => {
    for (const r of [1, 2, 3, 4, 5]) expect(scoreToRating(ratingToScore(r))).toBe(r)
    expect(ratingToScore(4)).toBe(8)
  })
})
