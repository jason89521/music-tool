import { describe, expect, it } from 'vitest'
import { generateRhythm } from '../domain/generateRhythm'
import {
  scoreEventIndex,
  scoreEventIndexAtTick,
  playbackTargetForScoreEvent,
  tiedScoreEventIndexesAtTick,
  toMusicXml,
} from './toMusicXml'
import type { RhythmExercise } from '../domain/rhythm'

describe('toMusicXml', () => {
  it('emits a percussion score with the requested number of measures', () => {
    const xml = toMusicXml(generateRhythm({ selectedMaterials: ['eighthTriplet'], measureCount: 3 }, () => 0.9))
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

  it('describes quarter-note triplets with the correct normal type', () => {
    const exercise = generateRhythm({ selectedMaterials: ['quarterTriplet'], measureCount: 1 }, () => 0.9)
    const xml = toMusicXml(exercise)

    expect(xml).toContain('<type>quarter</type>')
    expect(xml).toContain('<normal-type>quarter</normal-type>')
    expect(xml.match(/<tuplet type="start"/g)).toHaveLength(2)
    expect(xml.match(/<tuplet type="stop"/g)).toHaveLength(2)
  })

  it('merges rests only when the result preserves the strong-beat boundary', () => {
    const exercise: RhythmExercise = {
      version: 1,
      timeSignature: { beats: 4, beatType: 4 },
      measures: [{
        index: 0,
        events: [
          { id: 'first-rest', measureIndex: 0, startTick: 0, durationTicks: 24, value: 'quarter', rest: true, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'second-rest', measureIndex: 0, startTick: 24, durationTicks: 24, value: 'quarter', rest: true, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'note', measureIndex: 0, startTick: 48, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'last', measureIndex: 0, startTick: 72, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
        ],
      }],
    }

    const xml = toMusicXml(exercise)

    expect(xml.match(/<rest\/>/g)).toHaveLength(1)
    expect(xml).toMatch(/id="first-rest--rest-0"[\s\S]*<duration>48<\/duration>[\s\S]*<type>half<\/type>/)
    expect(scoreEventIndex(exercise, 0)).toBe(0)
    expect(scoreEventIndex(exercise, 1)).toBe(0)
    expect(scoreEventIndex(exercise, 2)).toBe(1)
  })

  it('splits a rest run at the next beat instead of obscuring it with a dotted rest', () => {
    const exercise: RhythmExercise = {
      version: 1,
      timeSignature: { beats: 4, beatType: 4 },
      measures: [{
        index: 0,
        events: [
          { id: 'first', measureIndex: 0, startTick: 0, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'eighth', measureIndex: 0, startTick: 24, durationTicks: 12, value: 'eighth', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'eighth-rest', measureIndex: 0, startTick: 36, durationTicks: 12, value: 'eighth', rest: true, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'quarter-rest', measureIndex: 0, startTick: 48, durationTicks: 24, value: 'quarter', rest: true, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'last', measureIndex: 0, startTick: 72, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
        ],
      }],
    }

    const xml = toMusicXml(exercise)
    const rests = xml.match(/<note id="[^"]+--rest-[^"]+">[\s\S]*?<\/note>/g) ?? []

    expect(rests).toHaveLength(2)
    expect(rests[0]).toMatch(/<duration>12<\/duration>[\s\S]*<type>eighth<\/type>/)
    expect(rests[1]).toMatch(/<duration>24<\/duration>[\s\S]*<type>quarter<\/type>/)
    expect(rests.join('')).not.toContain('<dot/>')
    expect(scoreEventIndex(exercise, 2)).toBe(2)
    expect(scoreEventIndex(exercise, 3)).toBe(3)
  })

  it('splits a note crossing the middle of the bar and joins its display fragments with ties', () => {
    const exercise: RhythmExercise = {
      version: 1,
      timeSignature: { beats: 4, beatType: 4 },
      measures: [{
        index: 0,
        events: [
          { id: 'first', measureIndex: 0, startTick: 0, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'crossing', measureIndex: 0, startTick: 24, durationTicks: 36, value: 'quarter', rest: false, dotted: true, triplet: false, tieStart: false, tieStop: false },
          { id: 'eighth', measureIndex: 0, startTick: 60, durationTicks: 12, value: 'eighth', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
          { id: 'last', measureIndex: 0, startTick: 72, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
        ],
      }],
    }

    const xml = toMusicXml(exercise)

    expect(xml).toMatch(/id="crossing--score-1"[\s\S]*<duration>24<\/duration>[\s\S]*<tie type="start"\/>/)
    expect(xml).toMatch(/id="crossing--score-2"[\s\S]*<duration>12<\/duration>[\s\S]*<tie type="stop"\/>/)
    expect(scoreEventIndex(exercise, 1)).toBe(1)
    expect(scoreEventIndexAtTick(exercise, 1, 24)).toBe(1)
    expect(scoreEventIndexAtTick(exercise, 1, 48)).toBe(2)
    expect(tiedScoreEventIndexesAtTick(exercise, 1, 24)).toEqual([1, 2])
    expect(tiedScoreEventIndexesAtTick(exercise, 1, 48)).toEqual([1, 2])
    expect(playbackTargetForScoreEvent(exercise, 2)).toEqual({ sourceEventIndex: 1, tick: 24 })
  })

  it('uses a whole rest for a full silent measure', () => {
    const exercise: RhythmExercise = {
      version: 1,
      timeSignature: { beats: 4, beatType: 4 },
      measures: [{
        index: 0,
        events: [
          { id: 'silent', measureIndex: 0, startTick: 0, durationTicks: 96, value: 'quarter', rest: true, dotted: false, triplet: false, tieStart: false, tieStop: false },
        ],
      }],
    }

    const xml = toMusicXml(exercise)

    expect(xml.match(/<rest measure="yes"\/>/g)).toHaveLength(1)
    expect(xml).toMatch(/<rest measure="yes"\/>[\s\S]*<duration>96<\/duration>[\s\S]*<type>whole<\/type>/)
  })

  it('rejects unsupported meters and incomplete measures', () => {
    const incomplete: RhythmExercise = {
      version: 1,
      timeSignature: { beats: 4, beatType: 4 },
      measures: [{
        index: 0,
        events: [
          { id: 'only', measureIndex: 0, startTick: 0, durationTicks: 24, value: 'quarter', rest: false, dotted: false, triplet: false, tieStart: false, tieStop: false },
        ],
      }],
    }

    expect(() => toMusicXml({ ...incomplete, timeSignature: { beats: 3, beatType: 4 } })).toThrow(/only 4\/4/)
    expect(() => toMusicXml(incomplete)).toThrow(/must contain 96 ticks/)
  })

  it('starts a new system after every four measures on wide screens', () => {
    const exercise = generateRhythm({ selectedMaterials: ['quarter'], measureCount: 9 }, () => 0.2)
    const xml = toMusicXml(exercise, { measuresPerSystem: 4 })

    expect(xml.match(/<print new-system="yes"\/>/g)).toHaveLength(2)
    expect(xml).toMatch(/<measure number="5">\s*<print new-system="yes"\/>/)
    expect(xml).toMatch(/<measure number="9">\s*<print new-system="yes"\/>/)
  })

  it('starts a new system for every measure on narrow screens', () => {
    const exercise = generateRhythm({ selectedMaterials: ['quarter'], measureCount: 4 }, () => 0.2)
    const xml = toMusicXml(exercise, { measuresPerSystem: 1 })

    expect(xml.match(/<print new-system="yes"\/>/g)).toHaveLength(3)
  })

  it('starts a new system after every two measures on medium screens', () => {
    const exercise = generateRhythm({ selectedMaterials: ['quarter'], measureCount: 5 }, () => 0.2)
    const xml = toMusicXml(exercise, { measuresPerSystem: 2 })

    expect(xml.match(/<print new-system="yes"\/>/g)).toHaveLength(2)
    expect(xml).toMatch(/<measure number="3">\s*<print new-system="yes"\/>/)
    expect(xml).toMatch(/<measure number="5">\s*<print new-system="yes"\/>/)
  })
})
