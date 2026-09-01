import { TICKS_PER_QUARTER, type RhythmEvent, type RhythmExercise } from '../domain/rhythm'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function typeFor(event: RhythmEvent): string {
  if (event.value === 'quarter') return 'quarter'
  if (event.value === 'eighth') return 'eighth'
  return '16th'
}

function beamLevel(event: RhythmEvent): number {
  if (event.rest) return 0
  if (event.value === 'sixteenth') return 2
  if (event.value === 'eighth') return 1
  return 0
}

function canBeamAtLevel(left: RhythmEvent | undefined, right: RhythmEvent | undefined, level: number): boolean {
  if (!left || !right || beamLevel(left) < level || beamLevel(right) < level) return false
  const contiguous = left.startTick + left.durationTicks === right.startTick
  const sameBeat = Math.floor(left.startTick / TICKS_PER_QUARTER) === Math.floor(right.startTick / TICKS_PER_QUARTER)
  return contiguous && sameBeat
}

function beamXml(events: RhythmEvent[], index: number): string {
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

function eventXml(event: RhythmEvent, index: number, events: RhythmEvent[]): string {
  const pitch = event.rest
    ? '<rest/>'
    : '<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><instrument id="P1-I1"/>'
  const tieSound = `${event.tieStop ? '<tie type="stop"/>' : ''}${event.tieStart ? '<tie type="start"/>' : ''}`
  const timeModification = event.triplet
    ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>eighth</normal-type></time-modification>'
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
      ${measure.events.map(eventXml).join('\n')}
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
