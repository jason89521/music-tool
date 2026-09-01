import {
  TICKS_PER_MEASURE,
  TICKS_PER_QUARTER,
  eventKey,
  type Difficulty,
  type GenerationSettings,
  type NoteValue,
  type RhythmEvent,
  type RhythmExercise,
} from './rhythm'

type PatternEvent = Pick<RhythmEvent, 'durationTicks' | 'value' | 'dotted' | 'triplet'>

const q = (durationTicks: number, value: NoteValue, dotted = false, triplet = false): PatternEvent => ({
  durationTicks,
  value,
  dotted,
  triplet,
})

const easyPatterns: PatternEvent[][] = [
  [q(24, 'quarter')],
  [q(12, 'eighth'), q(12, 'eighth')],
]

const mediumPatterns: PatternEvent[][] = [
  ...easyPatterns,
  [q(6, 'sixteenth'), q(6, 'sixteenth'), q(6, 'sixteenth'), q(6, 'sixteenth')],
  [q(12, 'eighth'), q(6, 'sixteenth'), q(6, 'sixteenth')],
  [q(6, 'sixteenth'), q(6, 'sixteenth'), q(12, 'eighth')],
  [q(18, 'eighth', true), q(6, 'sixteenth')],
  [q(6, 'sixteenth'), q(18, 'eighth', true)],
]

const hardPatterns: PatternEvent[][] = [
  ...mediumPatterns,
  [q(8, 'eighth', false, true), q(8, 'eighth', false, true), q(8, 'eighth', false, true)],
]

function patternsFor(difficulty: Difficulty): PatternEvent[][] {
  if (difficulty === 'easy') return easyPatterns
  if (difficulty === 'medium') return mediumPatterns
  return hardPatterns
}

function randomItem<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0]
}

function createMeasure(
  measureIndex: number,
  difficulty: Difficulty,
  random: () => number,
): RhythmEvent[] {
  const events: RhythmEvent[] = []
  const restChance = difficulty === 'hard' ? 0.25 : difficulty === 'medium' ? 0.18 : 0.12

  for (let beat = 0; beat < 4;) {
    const useDottedQuarter = difficulty !== 'easy' && beat <= 2 && random() < 0.12
    const pattern = useDottedQuarter
      ? [q(36, 'quarter', true), q(12, 'eighth')]
      : randomItem(patternsFor(difficulty), random)
    let cursor = beat * TICKS_PER_QUARTER
    pattern.forEach((part, partIndex) => {
      const canRest = !(beat === 0 && partIndex === 0 && difficulty !== 'hard')
      const previous = events.at(-1)
      const previousRestTicks = previous?.rest ? previous.durationTicks : 0
      const rest = canRest && previousRestTicks < TICKS_PER_QUARTER * 2 && random() < restChance
      events.push({
        ...part,
        id: `m${measureIndex}-t${cursor}`,
        measureIndex,
        startTick: cursor,
        rest,
        tieStart: false,
        tieStop: false,
      })
      cursor += part.durationTicks
    })
    beat += useDottedQuarter ? 2 : 1
  }

  if (events.every((event) => event.rest)) events[0].rest = false
  addOptionalTie(events, random)
  return events
}

function addOptionalTie(events: RhythmEvent[], random: () => number): void {
  if (random() >= 0.25) return
  const candidates = events.filter((event, index) => {
    const next = events[index + 1]
    return !event.rest && next !== undefined && !next.rest && event.startTick + event.durationTicks === next.startTick
  })
  const start = randomItem(candidates, random)
  if (!start) return
  const index = events.indexOf(start)
  start.tieStart = true
  events[index + 1].tieStop = true
}

function measureSignature(events: RhythmEvent[]): string {
  return events.map(eventKey).join('|')
}

function allFourBeatsMatch(events: RhythmEvent[]): boolean {
  const signatures = Array.from({ length: 4 }, (_, beat) => events
    .filter((event) => Math.floor(event.startTick / TICKS_PER_QUARTER) === beat)
    .map(eventKey)
    .join('|'))
  return new Set(signatures).size === 1
}

export function generateRhythm(
  settings: GenerationSettings,
  random: () => number = Math.random,
): RhythmExercise {
  const measureCount = Math.min(16, Math.max(1, Math.round(settings.measureCount)))
  const measures: RhythmExercise['measures'] = []
  for (let index = 0; index < measureCount; index += 1) {
    let events = createMeasure(index, settings.difficulty, random)
    const previous = measures.at(-1)
    let attempts = 0
    while ((allFourBeatsMatch(events) || (previous && measureSignature(events) === measureSignature(previous.events))) && attempts < 8) {
      events = createMeasure(index, settings.difficulty, random)
      attempts += 1
    }
    measures.push({ index, events })
  }

  return {
    version: 1,
    timeSignature: { beats: 4, beatType: 4 },
    difficulty: settings.difficulty,
    measures,
  }
}

export function totalTicks(exercise: RhythmExercise): number {
  return exercise.measures.length * TICKS_PER_MEASURE
}
