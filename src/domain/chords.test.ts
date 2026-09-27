import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, getChords, ROOTS } from './chords'

const expectedNotes = [
  ['C E G B', 'C E♭ G B♭', 'C E G B♭', 'C E♭ G♭ B♭', 'C E♭ G♭ B♭♭'],
  ['D♭ F A♭ C', 'D♭ F♭ A♭ C♭', 'D♭ F A♭ C♭', 'D♭ F♭ A♭♭ C♭', 'D♭ F♭ A♭♭ C♭♭'],
  ['D F♯ A C♯', 'D F A C', 'D F♯ A C', 'D F A♭ C', 'D F A♭ C♭'],
  ['E♭ G B♭ D', 'E♭ G♭ B♭ D♭', 'E♭ G B♭ D♭', 'E♭ G♭ B♭♭ D♭', 'E♭ G♭ B♭♭ D♭♭'],
  ['E G♯ B D♯', 'E G B D', 'E G♯ B D', 'E G B♭ D', 'E G B♭ D♭'],
  ['F A C E', 'F A♭ C E♭', 'F A C E♭', 'F A♭ C♭ E♭', 'F A♭ C♭ E♭♭'],
  ['G♭ B♭ D♭ F', 'G♭ B♭♭ D♭ F♭', 'G♭ B♭ D♭ F♭', 'G♭ B♭♭ D♭♭ F♭', 'G♭ B♭♭ D♭♭ F♭♭'],
  ['G B D F♯', 'G B♭ D F', 'G B D F', 'G B♭ D♭ F', 'G B♭ D♭ F♭'],
  ['A♭ C E♭ G', 'A♭ C♭ E♭ G♭', 'A♭ C E♭ G♭', 'A♭ C♭ E♭♭ G♭', 'A♭ C♭ E♭♭ G♭♭'],
  ['A C♯ E G♯', 'A C E G', 'A C♯ E G', 'A C E♭ G', 'A C E♭ G♭'],
  ['B♭ D F A', 'B♭ D♭ F A♭', 'B♭ D F A♭', 'B♭ D♭ F♭ A♭', 'B♭ D♭ F♭ A♭♭'],
  ['B D♯ F♯ A♯', 'B D F♯ A', 'B D♯ F♯ A', 'B D F A', 'B D F A♭'],
] as const

const formulaByQuality = ['1 3 5 7', '1 ♭3 5 ♭7', '1 3 5 ♭7', '1 ♭3 ♭5 ♭7', '1 ♭3 ♭5 ♭♭7'] as const
const expectedChords = ROOTS.flatMap((root, rootIndex) => CHORD_QUALITIES.map((quality, qualityIndex) => ({
  expectedName: quality.name,
  expectedNotes: expectedNotes[rootIndex][qualityIndex],
  expectedSymbol: `${root.name}${quality.symbol}`,
  formula: formulaByQuality[qualityIndex],
  qualityIndex,
  rootIndex,
})))

describe('chords', () => {
  it.each(expectedChords)('$expectedSymbol spells its chord tones correctly', (expected) => {
    const chord = getChords()[expected.rootIndex * CHORD_QUALITIES.length + expected.qualityIndex]

    expect(chord.symbol).toBe(expected.expectedSymbol)
    expect(chord.quality.name).toBe(expected.expectedName)
    expect(chord.quality.formula).toBe(expected.formula)
    expect(chord.degrees.join(' ')).toBe(expected.formula)
    expect(chord.notes.join(' ')).toBe(expected.expectedNotes)
  })

  it('keeps all 60 root and quality combinations in the reference', () => {
    expect(getChords()).toHaveLength(60)
    expect(new Set(getChords().map((chord) => chord.symbol)).size).toBe(60)
  })
})
