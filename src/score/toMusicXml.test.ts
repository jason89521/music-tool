import { describe, expect, it } from 'vitest'
import { generateRhythm } from '../domain/generateRhythm'
import { toMusicXml } from './toMusicXml'
import type { RhythmExercise } from '../domain/rhythm'

describe('toMusicXml', () => {
  it('emits a percussion score with the requested number of measures', () => {
    const xml = toMusicXml(generateRhythm({ difficulty: 'hard', measureCount: 3 }, () => 0.9))
    expect(xml).toContain('<sign>percussion</sign>')
    expect(xml).toContain('<staff-lines>5</staff-lines>')
    expect(xml.match(/<measure number=/g)).toHaveLength(3)
    expect(xml).toContain('<midi-unpitched>39</midi-unpitched>')
    expect(xml).not.toContain('<notehead>x</notehead>')
  })

  it('beams consecutive eighth notes within the same beat', () => {
    const exercise: RhythmExercise = {
      version: 1,
      timeSignature: { beats: 4, beatType: 4 },
      difficulty: 'easy',
      measures: [{
        index: 0,
        events: [
          { id: 'first', measureIndex: 0, startTick: 0, durationTicks: 12, value: 'eighth', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'second', measureIndex: 0, startTick: 12, durationTicks: 12, value: 'eighth', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'q2', measureIndex: 0, startTick: 24, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'q3', measureIndex: 0, startTick: 48, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'q4', measureIndex: 0, startTick: 72, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
        ],
      }],
    }

    const xml = toMusicXml(exercise)

    expect(xml).toMatch(/id="first"[\s\S]*<beam number="1">begin<\/beam>/)
    expect(xml).toMatch(/id="second"[\s\S]*<beam number="1">end<\/beam>/)
  })

  it('starts a new system after every four measures on wide screens', () => {
    const exercise = generateRhythm({ difficulty: 'easy', measureCount: 9 }, () => 0.2)
    const xml = toMusicXml(exercise, { measuresPerSystem: 4 })

    expect(xml.match(/<print new-system="yes"\/>/g)).toHaveLength(2)
    expect(xml).toMatch(/<measure number="5">\s*<print new-system="yes"\/>/)
    expect(xml).toMatch(/<measure number="9">\s*<print new-system="yes"\/>/)
  })

  it('starts a new system for every measure on narrow screens', () => {
    const exercise = generateRhythm({ difficulty: 'easy', measureCount: 4 }, () => 0.2)
    const xml = toMusicXml(exercise, { measuresPerSystem: 1 })

    expect(xml.match(/<print new-system="yes"\/>/g)).toHaveLength(3)
  })

  it('starts a new system after every two measures on medium screens', () => {
    const exercise = generateRhythm({ difficulty: 'easy', measureCount: 5 }, () => 0.2)
    const xml = toMusicXml(exercise, { measuresPerSystem: 2 })

    expect(xml.match(/<print new-system="yes"\/>/g)).toHaveLength(2)
    expect(xml).toMatch(/<measure number="3">\s*<print new-system="yes"\/>/)
    expect(xml).toMatch(/<measure number="5">\s*<print new-system="yes"\/>/)
  })
})
