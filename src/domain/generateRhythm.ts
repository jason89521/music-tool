import {
  TICKS_PER_MEASURE,
  TICKS_PER_QUARTER,
  type GenerationSettings,
  type NoteValue,
  type RhythmEvent,
  type RhythmExercise,
  type RhythmMaterial,
} from './rhythm'

type PatternEvent = Pick<RhythmEvent, 'durationTicks' | 'value' | 'dotted' | 'triplet'>
type Pattern = {
  events: PatternEvent[]
  materials: RhythmMaterial[]
}

const q = (durationTicks: number, value: NoteValue, dotted = false, triplet = false): PatternEvent => ({
  durationTicks,
  value,
  dotted,
  triplet,
})

const basicPatterns: Record<RhythmMaterial, Pattern> = {
  quarter: { events: [q(24, 'quarter')], materials: ['quarter'] },
  eighth: { events: [q(12, 'eighth'), q(12, 'eighth')], materials: ['eighth'] },
  sixteenth: {
    events: [q(6, 'sixteenth'), q(6, 'sixteenth'), q(6, 'sixteenth'), q(6, 'sixteenth')],
    materials: ['sixteenth'],
  },
  eighthTriplet: {
    events: [q(8, 'eighth', false, true), q(8, 'eighth', false, true), q(8, 'eighth', false, true)],
    materials: ['eighthTriplet'],
  },
  quarterTriplet: {
    events: [q(16, 'quarter', false, true), q(16, 'quarter', false, true), q(16, 'quarter', false, true)],
    materials: ['quarterTriplet'],
  },
}

const variationPatterns: Pattern[] = [
  {
    events: [q(12, 'eighth'), q(6, 'sixteenth'), q(6, 'sixteenth')],
    materials: ['eighth', 'sixteenth'],
  },
  {
    events: [q(6, 'sixteenth'), q(6, 'sixteenth'), q(12, 'eighth')],
    materials: ['eighth', 'sixteenth'],
  },
  {
    events: [q(18, 'eighth', true), q(6, 'sixteenth')],
    materials: ['eighth', 'sixteenth'],
  },
  {
    events: [q(6, 'sixteenth'), q(18, 'eighth', true)],
    materials: ['eighth', 'sixteenth'],
  },
  {
    events: [q(36, 'quarter', true), q(12, 'eighth')],
    materials: ['quarter', 'eighth'],
  },
]

function patternTicks(pattern: Pattern): number {
  return pattern.events.reduce((total, event) => total + event.durationTicks, 0)
}

function randomItem<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0]
}

function createMeasure(
  measureIndex: number,
  selectedMaterials: readonly RhythmMaterial[],
  exposure: Record<RhythmMaterial, number>,
  random: () => number,
): RhythmEvent[] {
  const events: RhythmEvent[] = []
  let cursor = 0

  while (cursor < TICKS_PER_MEASURE) {
    const remainingTicks = TICKS_PER_MEASURE - cursor
    const allowedVariations = variationPatterns.filter((pattern) => (
      patternTicks(pattern) <= remainingTicks
      && pattern.materials.every((material) => selectedMaterials.includes(material))
    ))
    const canUseQuarterTriplet = cursor % (TICKS_PER_QUARTER * 2) === 0
    const allowedBasics = selectedMaterials
      .filter((material) => material !== 'quarterTriplet' || canUseQuarterTriplet)
      .map((material) => basicPatterns[material])
      .filter((pattern) => patternTicks(pattern) <= remainingTicks)
    const useVariation = allowedVariations.length > 0 && random() < 0.12
    const pattern = useVariation
      ? randomItem(allowedVariations, random)
      : pickLeastExposed(allowedBasics, exposure, random)

    pattern.events.forEach((part) => {
      const previous = events.at(-1)
      const previousRestTicks = previous?.rest ? previous.durationTicks : 0
      const rest = previousRestTicks < TICKS_PER_QUARTER * 2 && random() < 0.18
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
    pattern.materials.forEach((material) => { exposure[material] += 1 })
  }

  if (events.every((event) => event.rest)) events[0].rest = false
  addOptionalTie(events, random)
  return events
}

function pickLeastExposed(
  patterns: readonly Pattern[],
  exposure: Readonly<Record<RhythmMaterial, number>>,
  random: () => number,
): Pattern {
  const lowestExposure = Math.min(...patterns.map((pattern) => exposure[pattern.materials[0]]))
  return randomItem(
    patterns.filter((pattern) => exposure[pattern.materials[0]] === lowestExposure),
    random,
  )
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

export function generateRhythm(
  settings: GenerationSettings,
  random: () => number = Math.random,
): RhythmExercise {
  const measureCount = Math.min(16, Math.max(1, Math.round(settings.measureCount)))
  const selectedMaterials = settings.selectedMaterials.length > 0
    ? settings.selectedMaterials
    : ['quarter'] satisfies RhythmMaterial[]
  const exposure: Record<RhythmMaterial, number> = {
    quarter: 0,
    eighth: 0,
    sixteenth: 0,
    eighthTriplet: 0,
    quarterTriplet: 0,
  }
  const measures: RhythmExercise['measures'] = []
  for (let index = 0; index < measureCount; index += 1) {
    const events = createMeasure(index, selectedMaterials, exposure, random)
    measures.push({ index, events })
  }

  return {
    version: 1,
    timeSignature: { beats: 4, beatType: 4 },
    measures,
  }
}

export function totalTicks(exercise: RhythmExercise): number {
  return exercise.measures.length * TICKS_PER_MEASURE
}
