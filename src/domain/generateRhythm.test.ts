import { describe, expect, it } from 'vitest'
import { generateRhythm } from './generateRhythm'
import { TICKS_PER_MEASURE } from './rhythm'

function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

describe('generateRhythm', () => {
  it.each(['easy', 'medium', 'hard'] as const)('fills every %s measure exactly', (difficulty) => {
    const exercise = generateRhythm({ difficulty, measureCount: 16 }, seededRandom(42))
    for (const measure of exercise.measures) {
      expect(measure.events.reduce((sum, event) => sum + event.durationTicks, 0)).toBe(TICKS_PER_MEASURE)
      expect(measure.events.some((event) => !event.rest)).toBe(true)
    }
  })

  it('clamps measure count to the supported range', () => {
    expect(generateRhythm({ difficulty: 'easy', measureCount: 0 }).measures).toHaveLength(1)
    expect(generateRhythm({ difficulty: 'easy', measureCount: 99 }).measures).toHaveLength(16)
  })

  it('never starts easy and medium exercises with a rest', () => {
    for (const difficulty of ['easy', 'medium'] as const) {
      const exercise = generateRhythm({ difficulty, measureCount: 16 }, seededRandom(7))
      expect(exercise.measures.every((measure) => !measure.events[0].rest)).toBe(true)
    }
  })
})
