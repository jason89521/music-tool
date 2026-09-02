export const TICKS_PER_QUARTER = 24
export const TICKS_PER_MEASURE = TICKS_PER_QUARTER * 4

export type NoteValue = 'quarter' | 'eighth' | 'sixteenth'
export type RhythmMaterial = NoteValue | 'eighthTriplet' | 'quarterTriplet'

export type RhythmEvent = {
  id: string
  measureIndex: number
  startTick: number
  durationTicks: number
  value: NoteValue
  rest: boolean
  dotted: boolean
  triplet: boolean
  tieStart: boolean
  tieStop: boolean
}

export type RhythmMeasure = {
  index: number
  events: RhythmEvent[]
}

export type RhythmExercise = {
  version: 1
  timeSignature: { beats: number; beatType: number }
  measures: RhythmMeasure[]
}

export type GenerationSettings = {
  measureCount: number
  selectedMaterials: RhythmMaterial[]
}

export type PlaybackSettings = {
  bpm: number
  countInMeasures: 1 | 2
  metronome: boolean
  loop: boolean
  snareVolume: number
  clickVolume: number
}

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  bpm: 80,
  countInMeasures: 1,
  metronome: true,
  loop: false,
  snareVolume: 0.8,
  clickVolume: 0.6,
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  measureCount: 4,
  selectedMaterials: ['quarter', 'eighth', 'sixteenth'],
}

export function isValidBpm(value: number): boolean {
  return Number.isInteger(value) && value >= 20 && value <= 400
}

export function eventKey(event: RhythmEvent): string {
  return [event.durationTicks, event.rest ? 'r' : 'n', event.dotted ? 'd' : '', event.triplet ? 't' : ''].join(':')
}
