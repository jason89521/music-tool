import { TICKS_PER_QUARTER, type RhythmEvent, type RhythmExercise } from '../domain/rhythm'

type ScoreEvent = RhythmEvent & {
  sourceEventCount: number
  notationType?: 'whole' | 'half' | 'quarter' | 'eighth' | '16th'
}

const REST_NOTATIONS: ReadonlyArray<{
  durationTicks: number
  notationType: NonNullable<ScoreEvent['notationType']>
  dotted: boolean
}> = [
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
  if (event.value === 'sixteenth') return 2
  if (event.value === 'eighth') return 1
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
    ? '<rest/>'
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

function scoreEvents(events: readonly RhythmEvent[]): ScoreEvent[] {
  const result: ScoreEvent[] = []

  for (let index = 0; index < events.length;) {
    const event = events[index]
    if (!event.rest || event.triplet) {
      result.push({ ...event, sourceEventCount: 1 })
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

    let consumedTicks = 0
    let consumedEvents = 0
    while (consumedTicks < runTicks) {
      const notation = REST_NOTATIONS.find(({ durationTicks }) => durationTicks <= runTicks - consumedTicks)
      if (!notation) {
        const source = events[index + consumedEvents]
        result.push({ ...source, sourceEventCount: 1 })
        consumedTicks += source.durationTicks
        consumedEvents += 1
        continue
      }

      let sourceEventCount = 0
      let sourceTicks = 0
      while (sourceTicks < notation.durationTicks && index + consumedEvents + sourceEventCount < runEnd) {
        sourceTicks += events[index + consumedEvents + sourceEventCount].durationTicks
        sourceEventCount += 1
      }
      if (sourceTicks !== notation.durationTicks) {
        const source = events[index + consumedEvents]
        result.push({ ...source, sourceEventCount: 1 })
        consumedTicks += source.durationTicks
        consumedEvents += 1
        continue
      }

      const source = events[index + consumedEvents]
      result.push({
        ...source,
        durationTicks: notation.durationTicks,
        dotted: notation.dotted,
        notationType: notation.notationType,
        sourceEventCount,
      })
      consumedTicks += notation.durationTicks
      consumedEvents += sourceEventCount
    }
    index = runEnd
  }

  return result
}

export function scoreEventIndex(exercise: RhythmExercise, sourceEventIndex: number): number {
  if (sourceEventIndex < 0) return -1
  const sourceEvents = exercise.measures.flatMap((measure) => measure.events)
  const activeEvent = sourceEvents[sourceEventIndex]
  if (!activeEvent) return -1

  let scoreIndex = 0
  let sourceIndex = 0
  for (const measure of exercise.measures) {
    for (const event of scoreEvents(measure.events)) {
      if (sourceEventIndex < sourceIndex + event.sourceEventCount) return scoreIndex
      sourceIndex += event.sourceEventCount
      scoreIndex += 1
    }
  }
  return -1
}

type MusicXmlLayout = {
  measuresPerSystem?: 1 | 2 | 4
}

export function toMusicXml(exercise: RhythmExercise, layout: MusicXmlLayout = {}): string {
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
