import { describe, it, expect } from 'vitest'
import { formatMmSs, parseMmSs } from './time'

describe('formatMmSs', () => {
  it('formats seconds as m:ss', () => {
    expect(formatMmSs(725)).toBe('12:05')
    expect(formatMmSs(0)).toBe('0:00')
    expect(formatMmSs(59)).toBe('0:59')
  })
  it('handles negatives', () => {
    expect(formatMmSs(-30)).toBe('-0:30')
  })
  it('handles non-finite', () => {
    expect(formatMmSs(NaN)).toBe('0:00')
    expect(formatMmSs(Infinity)).toBe('0:00')
  })
})

describe('parseMmSs', () => {
  it('parses m:ss', () => {
    expect(parseMmSs('1:05')).toBe(65)
    expect(parseMmSs('12:05')).toBe(725)
  })
  it('parses plain minutes', () => {
    expect(parseMmSs('15')).toBe(900)
  })
  it('returns null for invalid', () => {
    expect(parseMmSs('x')).toBeNull()
    expect(parseMmSs('')).toBeNull()
    expect(parseMmSs('1:5x')).toBeNull()
    expect(parseMmSs('1:75')).toBeNull()
  })
})
