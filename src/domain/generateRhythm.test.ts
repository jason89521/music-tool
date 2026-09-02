import { describe, expect, it } from 'vitest'
import { generateRhythm } from './generateRhythm'
import { TICKS_PER_MEASURE, type RhythmMaterial } from './rhythm'

function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

describe('generateRhythm', () => {
  const settings = (selectedMaterials: RhythmMaterial[], measureCount = 16) => ({ selectedMaterials, measureCount })

  it.each([
    'quarter',
    'eighth',
    'sixteenth',
    'eighthTriplet',
    'quarterTriplet',
  ] as const)('fills every measure exactly with only %s selected', (material) => {
    const exercise = generateRhythm(settings([material]), seededRandom(42))
    for (const measure of exercise.measures) {
      expect(measure.events.reduce((sum, event) => sum + event.durationTicks, 0)).toBe(TICKS_PER_MEASURE)
      expect(measure.events.some((event) => !event.rest)).toBe(true)
    }
  })

  it('clamps measure count to the supported range', () => {
    expect(generateRhythm(settings(['quarter'], 0)).measures).toHaveLength(1)
    expect(generateRhythm(settings(['quarter'], 99)).measures).toHaveLength(16)
  })

  it('allows a measure to start with a rest', () => {
    const randomValues = [0.5, 0.1]
    const exercise = generateRhythm(settings(['quarter'], 1), () => randomValues.shift() ?? 0.9)
    expect(exercise.measures.some((measure) => measure.events[0].rest)).toBe(true)
  })

  it('keeps ordinary notes independent from their triplet variants', () => {
    const eighthTriplets = generateRhythm(settings(['eighthTriplet'], 2), seededRandom(3))
    expect(eighthTriplets.measures.flatMap((measure) => measure.events).every((event) => (
      event.value === 'eighth' && event.triplet
    ))).toBe(true)

    const quarterTriplets = generateRhythm(settings(['quarterTriplet'], 2), seededRandom(3))
    expect(quarterTriplets.measures.flatMap((measure) => measure.events).every((event) => (
      event.value === 'quarter' && event.triplet
    ))).toBe(true)
  })

  it('includes every selected basic material when space allows', () => {
    const exercise = generateRhythm(
      settings(['quarter', 'eighth', 'sixteenth', 'eighthTriplet', 'quarterTriplet'], 4),
      () => 0.9,
    )
    const events = exercise.measures.flatMap((measure) => measure.events)
    expect(events.some((event) => event.value === 'quarter' && !event.triplet)).toBe(true)
    expect(events.some((event) => event.value === 'eighth' && !event.triplet)).toBe(true)
    expect(events.some((event) => event.value === 'sixteenth')).toBe(true)
    expect(events.some((event) => event.value === 'eighth' && event.triplet)).toBe(true)
    expect(events.some((event) => event.value === 'quarter' && event.triplet)).toBe(true)
  })
})
