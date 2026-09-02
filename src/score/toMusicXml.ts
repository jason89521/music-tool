import { TICKS_PER_MEASURE, TICKS_PER_QUARTER, type RhythmEvent, type RhythmExercise } from '../domain/rhythm'

type ScoreEvent = RhythmEvent & {
  sourceEventIndexes: number[]
  notationType?: 'whole' | 'half' | 'quarter' | 'eighth' | '16th'
}

type Notation = {
  durationTicks: number
  notationType: NonNullable<ScoreEvent['notationType']>
  dotted: boolean
}

const NOTATIONS: readonly Notation[] = [
  { durationTicks: 96, notationType: 'whole', dotted: false },
  { durationTicks: 72, notationType: 'half', dotted: true },
  { durationTicks: 48, notationType: 'half', dotted: false },
  { durationTicks: 36, notationType: 'quarter', dotted: true },
  { durationTicks: 24, notationType: 'quarter', dotted: false },
  { durationTicks: 18, notationType: 'eighth', dotted: true },
  { durationTicks: 12, notationType: 'eighth', dotted: false },
  { durationTicks: 6, notationType: '16th', dotted: false },
]

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function typeFor(event: ScoreEvent): string {
  if (event.notationType) return event.notationType
  if (event.value === 'quarter') return 'quarter'
  if (event.value === 'eighth') return 'eighth'
  return '16th'
}

function beamLevel(event: ScoreEvent): number {
  if (event.rest) return 0
  if (typeFor(event) === '16th') return 2
  if (typeFor(event) === 'eighth') return 1
  return 0
}

function canBeamAtLevel(left: ScoreEvent | undefined, right: ScoreEvent | undefined, level: number): boolean {
  if (!left || !right || beamLevel(left) < level || beamLevel(right) < level) return false
  const contiguous = left.startTick + left.durationTicks === right.startTick
  const sameBeat = Math.floor(left.startTick / TICKS_PER_QUARTER) === Math.floor(right.startTick / TICKS_PER_QUARTER)
  return contiguous && sameBeat
}

function beamXml(events: ScoreEvent[], index: number): string {
  const event = events[index]
  const levelCount = beamLevel(event)
  if (levelCount === 0) return ''

  return Array.from({ length: levelCount }, (_, levelIndex) => {
    const level = levelIndex + 1
    const connectsBackward = canBeamAtLevel(events[index - 1], event, level)
    const connectsForward = canBeamAtLevel(event, events[index + 1], level)
    let value: 'begin' | 'continue' | 'end' | 'forward hook' | 'backward hook' | undefined
    if (connectsBackward && connectsForward) value = 'continue'
    else if (connectsForward) value = 'begin'
    else if (connectsBackward) value = 'end'
    else if (level > 1 && canBeamAtLevel(events[index - 1], event, 1)) value = 'backward hook'
    else if (level > 1 && canBeamAtLevel(event, events[index + 1], 1)) value = 'forward hook'
    return value ? `<beam number="${level}">${value}</beam>` : ''
  }).join('')
}

function eventXml(event: ScoreEvent, index: number, events: ScoreEvent[]): string {
  const pitch = event.rest
    ? event.startTick === 0 && event.durationTicks === TICKS_PER_MEASURE ? '<rest measure="yes"/>' : '<rest/>'
    : '<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><instrument id="P1-I1"/>'
  const tieSound = `${event.tieStop ? '<tie type="stop"/>' : ''}${event.tieStart ? '<tie type="start"/>' : ''}`
  const timeModification = event.triplet
    ? `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>${typeFor(event)}</normal-type></time-modification>`
    : ''
  const tiedNotation = `${event.tieStop ? '<tied type="stop"/>' : ''}${event.tieStart ? '<tied type="start"/>' : ''}`
  const tupletNotation = event.triplet
    ? `${event.startTick % TICKS_PER_QUARTER === 0 ? '<tuplet type="start" bracket="yes"/>' : ''}${(event.startTick + event.durationTicks) % TICKS_PER_QUARTER === 0 ? '<tuplet type="stop"/>' : ''}`
    : ''
  const notations = tiedNotation || tupletNotation ? `<notations>${tiedNotation}${tupletNotation}</notations>` : ''

  return `<note id="${escapeXml(event.id)}">
    ${pitch}
    <duration>${event.durationTicks}</duration>
    ${tieSound}
    <voice>1</voice>
    <type>${typeFor(event)}</type>
    ${event.dotted ? '<dot/>' : ''}
    ${timeModification}
    ${beamXml(events, index)}
    ${notations}
  </note>`
}

function metricalStrength(tick: number): number {
  if (tick % 96 === 0) return 4
  if (tick % 48 === 0) return 3
  if (tick % 24 === 0) return 2
  if (tick % 12 === 0) return 1
  if (tick % 6 === 0) return 0
  return -1
}

function doesNotObscureStrongerBeat(startTick: number, durationTicks: number): boolean {
  const startStrength = metricalStrength(startTick)
  for (let tick = startTick + 6; tick < startTick + durationTicks; tick += 6) {
    if (metricalStrength(tick) > startStrength) return false
  }
  return true
}

function spellDuration(startTick: number, durationTicks: number): Array<Notation & { startTick: number }> {
  const result: Array<Notation & { startTick: number }> = []
  let cursor = startTick
  let remainingTicks = durationTicks

  while (remainingTicks > 0) {
    const notation = NOTATIONS.find(({ durationTicks: candidateTicks }) => (
      candidateTicks <= remainingTicks && doesNotObscureStrongerBeat(cursor, candidateTicks)
    ))
    if (!notation) throw new Error(`Cannot spell ${durationTicks} ticks from tick ${startTick}`)
    result.push({ ...notation, startTick: cursor })
    cursor += notation.durationTicks
    remainingTicks -= notation.durationTicks
  }
  return result
}

function scoreEvents(events: readonly RhythmEvent[]): ScoreEvent[] {
  const result: ScoreEvent[] = []

  for (let index = 0; index < events.length;) {
    const event = events[index]
    if (event.triplet) {
      result.push({ ...event, sourceEventIndexes: [index] })
      index += 1
      continue
    }

    if (!event.rest) {
      const fragments = spellDuration(event.startTick, event.durationTicks)
      fragments.forEach((fragment, fragmentIndex) => {
        const isFirst = fragmentIndex === 0
        const isLast = fragmentIndex === fragments.length - 1
        result.push({
          ...event,
          id: fragments.length === 1 ? event.id : `${event.id}--score-${fragmentIndex + 1}`,
          startTick: fragment.startTick,
          durationTicks: fragment.durationTicks,
          dotted: fragment.dotted,
          notationType: fragment.notationType,
          tieStop: !isFirst || event.tieStop,
          tieStart: !isLast || event.tieStart,
          sourceEventIndexes: [index],
        })
      })
      index += 1
      continue
    }

    let runEnd = index
    let runTicks = 0
    while (
      runEnd < events.length
      && events[runEnd].rest
      && !events[runEnd].triplet
      && (runEnd === index || events[runEnd - 1].startTick + events[runEnd - 1].durationTicks === events[runEnd].startTick)
    ) {
      runTicks += events[runEnd].durationTicks
      runEnd += 1
    }

    for (const notation of spellDuration(event.startTick, runTicks)) {
      const notationEnd = notation.startTick + notation.durationTicks
      const sourceEventIndexes = events
        .slice(index, runEnd)
        .map((_, offset) => index + offset)
        .filter((sourceIndex) => {
          const source = events[sourceIndex]
          return source.startTick < notationEnd && source.startTick + source.durationTicks > notation.startTick
        })
      result.push({
        ...events[sourceEventIndexes[0]],
        id: `${events[sourceEventIndexes[0]].id}--rest-${notation.startTick}`,
        startTick: notation.startTick,
        durationTicks: notation.durationTicks,
        dotted: notation.dotted,
        notationType: notation.notationType,
        tieStart: false,
        tieStop: false,
        sourceEventIndexes,
      })
    }
    index = runEnd
  }

  return result
}

function assertSupportedExercise(exercise: RhythmExercise): void {
  if (exercise.timeSignature.beats !== 4 || exercise.timeSignature.beatType !== 4) {
    throw new Error('Score spelling currently supports only 4/4 time')
  }
  for (const measure of exercise.measures) {
    let expectedStartTick = 0
    for (const event of measure.events) {
      if (!Number.isInteger(event.durationTicks) || event.durationTicks <= 0) {
        throw new Error(`Invalid duration for event ${event.id}`)
      }
      if (event.startTick !== expectedStartTick) {
        throw new Error(`Events in measure ${measure.index} must be contiguous`)
      }
      const supportedTriplet = (event.value === 'eighth' && event.durationTicks === 8)
        || (event.value === 'quarter' && event.durationTicks === 16)
      if (event.triplet && !supportedTriplet) {
        throw new Error(`Cannot spell triplet event ${event.id}`)
      }
      if (!event.triplet && event.durationTicks % 6 !== 0) {
        throw new Error(`Cannot spell event ${event.id} with the supported note values`)
      }
      expectedStartTick += event.durationTicks
    }
    if (expectedStartTick !== TICKS_PER_MEASURE) {
      throw new Error(`Measure ${measure.index} must contain ${TICKS_PER_MEASURE} ticks`)
    }
  }
}

export function scoreEventIndex(exercise: RhythmExercise, sourceEventIndex: number): number {
  assertSupportedExercise(exercise)
  if (sourceEventIndex < 0) return -1
  const sourceEvents = exercise.measures.flatMap((measure) => measure.events)
  const activeEvent = sourceEvents[sourceEventIndex]
  if (!activeEvent) return -1

  let scoreIndex = 0
  let sourceIndex = 0
  for (const measure of exercise.measures) {
    for (const event of scoreEvents(measure.events)) {
      if (event.sourceEventIndexes.includes(sourceEventIndex - sourceIndex)) return scoreIndex
      scoreIndex += 1
    }
    sourceIndex += measure.events.length
  }
  return -1
}

export function scoreEventIndexAtTick(
  exercise: RhythmExercise,
  sourceEventIndex: number,
  absoluteTick: number,
): number {
  assertSupportedExercise(exercise)
  if (sourceEventIndex < 0 || absoluteTick < 0) return -1

  const sourceEvents = exercise.measures.flatMap((measure) => measure.events)
  if (!sourceEvents[sourceEventIndex]) return -1

  let scoreIndex = 0
  for (const measure of exercise.measures) {
    for (const event of scoreEvents(measure.events)) {
      const eventStart = measure.index * TICKS_PER_MEASURE + event.startTick
      if (absoluteTick >= eventStart && absoluteTick < eventStart + event.durationTicks) return scoreIndex
      scoreIndex += 1
    }
  }
  return -1
}

export function tiedScoreEventIndexesAtTick(
  exercise: RhythmExercise,
  sourceEventIndex: number,
  absoluteTick: number,
): number[] {
  const activeScoreIndex = scoreEventIndexAtTick(exercise, sourceEventIndex, absoluteTick)
  if (activeScoreIndex < 0) return []

  const events = exercise.measures.flatMap((measure) => scoreEvents(measure.events))
  const activeEvent = events[activeScoreIndex]
  if (!activeEvent?.tieStart && !activeEvent?.tieStop) return []

  let chainStart = activeScoreIndex
  while (chainStart > 0 && events[chainStart].tieStop && events[chainStart - 1].tieStart) chainStart -= 1

  let chainEnd = activeScoreIndex
  while (
    chainEnd < events.length - 1
    && events[chainEnd].tieStart
    && events[chainEnd + 1].tieStop
  ) chainEnd += 1

  return Array.from({ length: chainEnd - chainStart + 1 }, (_, index) => chainStart + index)
}

export type ScorePlaybackTarget = {
  sourceEventIndex: number
  tick: number
}

export function playbackTargetForScoreEvent(
  exercise: RhythmExercise,
  selectedScoreEventIndex: number,
): ScorePlaybackTarget | undefined {
  assertSupportedExercise(exercise)
  if (selectedScoreEventIndex < 0) return undefined

  const events = exercise.measures.flatMap((measure) => scoreEvents(measure.events))
  if (!events[selectedScoreEventIndex]) return undefined

  let targetScoreIndex = selectedScoreEventIndex
  while (
    targetScoreIndex > 0
    && events[targetScoreIndex].tieStop
    && events[targetScoreIndex - 1].tieStart
  ) targetScoreIndex -= 1

  let scoreIndex = 0
  let sourceIndexOffset = 0
  for (const measure of exercise.measures) {
    const measureScoreEvents = scoreEvents(measure.events)
    for (const event of measureScoreEvents) {
      if (scoreIndex === targetScoreIndex) {
        return {
          sourceEventIndex: sourceIndexOffset + event.sourceEventIndexes[0],
          tick: measure.index * TICKS_PER_MEASURE + event.startTick,
        }
      }
      scoreIndex += 1
    }
    sourceIndexOffset += measure.events.length
  }
  return undefined
}

type MusicXmlLayout = {
  measuresPerSystem?: 1 | 2 | 4
}

export function toMusicXml(exercise: RhythmExercise, layout: MusicXmlLayout = {}): string {
  assertSupportedExercise(exercise)
  const measuresPerSystem = layout.measuresPerSystem ?? 4
  const measures = exercise.measures
    .map((measure, index) => `<measure number="${index + 1}">
      ${index > 0 && index % measuresPerSystem === 0 ? '<print new-system="yes"/>' : ''}
      ${index === 0 ? `<attributes>
        <divisions>${TICKS_PER_QUARTER}</divisions>
        <time><beats>${exercise.timeSignature.beats}</beats><beat-type>${exercise.timeSignature.beatType}</beat-type></time>
        <staff-details><staff-lines>5</staff-lines></staff-details>
        <clef><sign>percussion</sign><line>2</line></clef>
      </attributes>` : ''}
      ${scoreEvents(measure.events).map(eventXml).join('\n')}
      ${index === exercise.measures.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ''}
    </measure>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>節奏練習</work-title></work>
  <part-list>
    <score-part id="P1">
      <part-name>小鼓</part-name>
      <score-instrument id="P1-I1"><instrument-name>Snare Drum</instrument-name></score-instrument>
      <midi-instrument id="P1-I1"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">${measures}</part>
</score-partwise>`
}
