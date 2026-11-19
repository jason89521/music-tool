import { frequencyToMidi } from '../audioPractice/pitch/types'
import { formatTime } from '../audioPractice/time'

export const pitchAxisWidth = 45
export const timeAxisHeight = 25
const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const maxContinuousSemitonesPerSecond = 400

export type PitchViewport = { start: number; span: number; low: number; range: number }
export type PitchInterval = { start: number; end: number; enabled: boolean }

export function pitchDisplayData(hz: Float32Array) {
  const counts = new Uint32Array(128)
  let voiced = 0
  const midi = Float32Array.from(hz, (frequency) => {
    if (!frequency) return NaN
    const note = frequencyToMidi(frequency)
    counts[Math.round(note)]++
    voiced++
    return note
  })
  if (!voiced) return { midi, hasPitch: false, low: 36, range: 24 }

  let cumulative = 0
  const low = counts.findIndex((count) => (cumulative += count) > voiced * 0.02)
  cumulative = 0
  let high = counts.length - 1
  while ((cumulative += counts[high]) <= voiced * 0.02) high--
  const range = Math.max(12, high - low + 6)
  return { midi, hasPitch: true, range, low: (low + high - range) / 2 }
}

export function drawPitchPlot(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: PitchViewport,
  midi: Float32Array,
  frameStep: number,
  interval?: PitchInterval,
) {
  const plotWidth = width - pitchAxisWidth
  const plotHeight = height - timeAxisHeight
  if (plotWidth <= 0 || plotHeight <= 0) return
  const { start, span, low, range } = viewport
  const top = low + range
  const rowHeight = plotHeight / range
  const x = (time: number) => pitchAxisWidth + plotWidth * (time - start) / span
  const y = (note: number) => rowHeight * (top - note)

  context.fillStyle = '#fffdf9'
  context.fillRect(0, 0, width, height)

  context.save()
  context.beginPath()
  context.rect(0, 0, width, plotHeight)
  context.clip()
  for (let note = Math.floor(low); note <= Math.ceil(top); note++) {
    const name = noteNames[note % 12]
    const sharp = name.includes('♯')
    const octave = note % 12 === 0
    const rowTop = y(note + 0.5)
    context.fillStyle = sharp ? '#eee8de' : '#fff6e9'
    context.fillRect(0, rowTop, pitchAxisWidth, rowHeight)
    if (sharp) {
      context.fillStyle = '#faf6ef'
      context.fillRect(pitchAxisWidth, rowTop, plotWidth, rowHeight)
    }
    context.fillStyle = octave ? '#d6cbbd' : '#efe8de'
    context.fillRect(pitchAxisWidth, Math.round(y(note)) + 0.5, plotWidth, 1)

    if (octave || rowHeight >= (sharp ? 17 : 12)) {
      context.font = octave ? 'bold 11px system-ui' : '11px system-ui'
      context.textBaseline = 'middle'
      context.fillStyle = '#534c45'
      context.fillText(`${name}${Math.floor(note / 12) - 1}`, 8, y(note))
    }
  }
  context.restore()

  context.font = '11px system-ui'
  context.textBaseline = 'middle'
  context.fillStyle = '#716c65'
  const tickStep = niceTickStep(span / Math.max(1, plotWidth / 81))
  const firstTick = Math.ceil(start / tickStep)
  for (let tick = firstTick; tick * tickStep <= start + span; tick++) {
    const time = tick * tickStep
    const pixel = x(time)
    context.fillStyle = '#eae2d6'
    context.fillRect(Math.round(pixel), 0, 1, plotHeight + 4)
    if (pixel + 48 <= width) {
      context.fillStyle = '#716c65'
      context.fillText(formatTime(time), pixel + 3, plotHeight + 13)
    }
  }

  context.save()
  context.beginPath()
  context.rect(pitchAxisWidth, 0, plotWidth, plotHeight)
  context.clip()
  if (interval) {
    const left = x(interval.start)
    const right = x(interval.end)
    context.fillStyle = interval.enabled ? '#d5543522' : '#5b798d20'
    context.fillRect(left, 0, right - left, plotHeight)
    context.fillStyle = interval.enabled ? '#b94329' : '#50697a'
    context.fillRect(left, 0, 1, plotHeight)
    context.fillRect(right, 0, 1, plotHeight)
  }

  const first = Math.max(0, Math.floor(start / frameStep))
  const last = Math.min(midi.length - 1, Math.ceil((start + span) / frameStep))
  const maxFrameJump = maxContinuousSemitonesPerSecond * frameStep
  context.beginPath()
  context.strokeStyle = '#b94329'
  context.lineWidth = 1.6
  context.lineJoin = 'round'
  context.lineCap = 'round'
  let connected = false
  let lastX = -Infinity
  let lastY = -Infinity
  for (let i = first; i <= last; i++) {
    const note = midi[i]
    if (Number.isNaN(note)) {
      connected = false
      continue
    }
    const pointX = x(i * frameStep)
    const pointY = y(note)
    // Adjacent estimates can belong to different notes. Check continuity before
    // dropping subpixel points so zooming never creates a bridge across a jump.
    if (!connected || Math.abs(note - midi[i - 1]) > maxFrameJump) {
      context.moveTo(pointX, pointY)
      context.lineTo(pointX + 0.1, pointY)
    } else {
      if (pointX - lastX < 0.7 && Math.abs(pointY - lastY) < 0.65) continue
      context.lineTo(pointX, pointY)
    }
    connected = true
    lastX = pointX
    lastY = pointY
  }
  context.stroke()
  context.restore()
  context.fillStyle = '#ded7ca'
  context.fillRect(pitchAxisWidth - 1, 0, 1, plotHeight)
  context.fillRect(0, plotHeight, width, 1)
}

function niceTickStep(target: number) {
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const ratio = target / magnitude
  return magnitude * (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10)
}
