import { describe, expect, it } from 'vitest'
import { formatTime, isValidInterval, parseTime } from './time'

describe('audio practice time values', () => {
  it('parses seconds and mm:ss.xx', () => {
    expect(parseTime('83.45')).toBe(83.45)
    expect(parseTime('01:23.45')).toBe(83.45)
    expect(formatTime(83.45)).toBe('01:23.45')
  })

  it('rejects malformed values and invalid intervals', () => {
    expect(parseTime('01:75.2')).toBeUndefined()
    expect(parseTime('-1')).toBeUndefined()
    expect(isValidInterval(2, 4, 4)).toBe(true)
    expect(isValidInterval(4, 4, 5)).toBe(false)
    expect(isValidInterval(-1, 2, 5)).toBe(false)
  })
})
