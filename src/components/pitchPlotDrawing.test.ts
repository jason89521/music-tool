import { expect, it, vi } from 'vitest'
import { drawPitchPlot } from './pitchPlotDrawing'

function drawContour(notes: number[], span = 12) {
  const moveTo = vi.fn<(x: number, y: number) => void>()
  const lineTo = vi.fn<(x: number, y: number) => void>()
  const context = {
    beginPath: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    moveTo,
    lineTo,
  } as unknown as CanvasRenderingContext2D

  drawPitchPlot(context, 545, 265, { start: 0, span, low: 36, range: 24 }, Float32Array.from(notes), 0.01)
  return { moveTo, lineTo }
}

it('starts a new contour when adjacent frames jump by an octave', () => {
  const { moveTo, lineTo } = drawContour([41, 53])

  expect(moveTo).toHaveBeenCalledTimes(2)
  expect(lineTo.mock.calls.map(([, y]) => y)).toEqual(moveTo.mock.calls.map(([, y]) => y))
})

it.each([1, 120])('keeps a short octave excursion separate at a %s-second zoom level', (span) => {
  const { moveTo, lineTo } = drawContour([45, 33, 45], span)

  expect(moveTo).toHaveBeenCalledTimes(3)
  expect(lineTo.mock.calls.map(([, y]) => y)).toEqual(moveTo.mock.calls.map(([, y]) => y))
})

it('keeps a continuous slide and fractional pitch changes connected', () => {
  const notes = [41, 43.2, 46.5, 49.8, 53, 53.4, 53.15, 52.8]
  const { moveTo, lineTo } = drawContour(notes, 1)

  expect(moveTo).toHaveBeenCalledTimes(1)
  expect(lineTo).toHaveBeenCalledTimes(notes.length)
  for (const [index, [, y]] of lineTo.mock.calls.entries()) {
    expect(y).toBeCloseTo(10 * (60 - notes[index]), 4)
  }
})

it('checks continuity against the preceding frame even when it was skipped at this zoom', () => {
  const { moveTo, lineTo } = drawContour([41, 41.05, 45.02], 120)

  expect(moveTo).toHaveBeenCalledTimes(1)
  expect(lineTo).toHaveBeenCalledTimes(2)
})

it('begins a new contour after an unvoiced frame', () => {
  const { moveTo, lineTo } = drawContour([45, NaN, 45.2])

  expect(moveTo).toHaveBeenCalledTimes(2)
  expect(lineTo.mock.calls.map(([, y]) => y)).toEqual(moveTo.mock.calls.map(([, y]) => y))
})
