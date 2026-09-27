type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

export type ChordDegree = {
  number: 1 | 3 | 5 | 7
  alteration: -2 | -1 | 0
  label: string
}

export type Root = {
  name: string
  letter: Letter
  accidental: number
  semitone: number
}

export type ChordQuality = {
  symbol: '△7' | '-7' | '7' | 'ø7' | '°7'
  name: string
  degrees: readonly ChordDegree[]
  formula: string
}

export type Chord = {
  root: Root
  quality: ChordQuality
  symbol: string
  degrees: readonly string[]
  notes: readonly string[]
}

const NATURAL_SEMITONES: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const DEGREE_SEMITONES: Record<ChordDegree['number'], number> = {
  1: 0,
  3: 4,
  5: 7,
  7: 11,
}

const DEGREE_LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

export const ROOTS: readonly Root[] = [
  { name: 'C', letter: 'C', accidental: 0, semitone: 0 },
  { name: 'D♭', letter: 'D', accidental: -1, semitone: 1 },
  { name: 'D', letter: 'D', accidental: 0, semitone: 2 },
  { name: 'E♭', letter: 'E', accidental: -1, semitone: 3 },
  { name: 'E', letter: 'E', accidental: 0, semitone: 4 },
  { name: 'F', letter: 'F', accidental: 0, semitone: 5 },
  { name: 'G♭', letter: 'G', accidental: -1, semitone: 6 },
  { name: 'G', letter: 'G', accidental: 0, semitone: 7 },
  { name: 'A♭', letter: 'A', accidental: -1, semitone: 8 },
  { name: 'A', letter: 'A', accidental: 0, semitone: 9 },
  { name: 'B♭', letter: 'B', accidental: -1, semitone: 10 },
  { name: 'B', letter: 'B', accidental: 0, semitone: 11 },
]

export const CHORD_QUALITIES: readonly ChordQuality[] = [
  {
    symbol: '△7',
    name: 'Major Seventh',
    degrees: [
      { number: 1, alteration: 0, label: '1' },
      { number: 3, alteration: 0, label: '3' },
      { number: 5, alteration: 0, label: '5' },
      { number: 7, alteration: 0, label: '7' },
    ],
    formula: '1 3 5 7',
  },
  {
    symbol: '-7',
    name: 'Minor Seventh',
    degrees: [
      { number: 1, alteration: 0, label: '1' },
      { number: 3, alteration: -1, label: '♭3' },
      { number: 5, alteration: 0, label: '5' },
      { number: 7, alteration: -1, label: '♭7' },
    ],
    formula: '1 ♭3 5 ♭7',
  },
  {
    symbol: '7',
    name: 'Dominant Seventh',
    degrees: [
      { number: 1, alteration: 0, label: '1' },
      { number: 3, alteration: 0, label: '3' },
      { number: 5, alteration: 0, label: '5' },
      { number: 7, alteration: -1, label: '♭7' },
    ],
    formula: '1 3 5 ♭7',
  },
  {
    symbol: 'ø7',
    name: 'Half-diminished Seventh',
    degrees: [
      { number: 1, alteration: 0, label: '1' },
      { number: 3, alteration: -1, label: '♭3' },
      { number: 5, alteration: -1, label: '♭5' },
      { number: 7, alteration: -1, label: '♭7' },
    ],
    formula: '1 ♭3 ♭5 ♭7',
  },
  {
    symbol: '°7',
    name: 'Diminished Seventh',
    degrees: [
      { number: 1, alteration: 0, label: '1' },
      { number: 3, alteration: -1, label: '♭3' },
      { number: 5, alteration: -1, label: '♭5' },
      { number: 7, alteration: -2, label: '♭♭7' },
    ],
    formula: '1 ♭3 ♭5 ♭♭7',
  },
]

function wrapSemitone(value: number): number {
  return ((value % 12) + 12) % 12
}

function accidentalText(accidental: number): string {
  if (accidental === 0) return ''
  if (accidental > 0) return '♯'.repeat(accidental)
  return '♭'.repeat(Math.abs(accidental))
}

function degreeLetter(root: Root, degree: ChordDegree['number']): Letter {
  const rootIndex = DEGREE_LETTERS.indexOf(root.letter)
  const degreeIndex = (rootIndex + degree - 1) % DEGREE_LETTERS.length
  return DEGREE_LETTERS[degreeIndex]
}

function signedAccidentalDifference(target: number, natural: number): number {
  const difference = wrapSemitone(target - natural)
  return difference <= 6 ? difference : difference - 12
}

function spellDegree(root: Root, degree: ChordDegree): string {
  const letter = degreeLetter(root, degree.number)
  const targetSemitone = wrapSemitone(
    root.semitone + DEGREE_SEMITONES[degree.number] + degree.alteration,
  )
  const naturalSemitone = NATURAL_SEMITONES[letter]
  const accidental = signedAccidentalDifference(targetSemitone, naturalSemitone)

  if (accidental < -2 || accidental > 2) {
    throw new Error(`Unable to spell ${root.name} degree ${degree.label}`)
  }

  return `${letter}${accidentalText(accidental)}`
}

export function buildChord(root: Root, quality: ChordQuality): Chord {
  return {
    root,
    quality,
    symbol: `${root.name}${quality.symbol}`,
    degrees: quality.degrees.map((degree) => degree.label),
    notes: quality.degrees.map((degree) => spellDegree(root, degree)),
  }
}

export function getChords(): readonly Chord[] {
  return ROOTS.flatMap((root) => CHORD_QUALITIES.map((quality) => buildChord(root, quality)))
}

export function getChordsForRoot(root: Root): readonly Chord[] {
  return CHORD_QUALITIES.map((quality) => buildChord(root, quality))
}
