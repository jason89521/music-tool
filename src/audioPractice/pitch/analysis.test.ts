import { describe, expect, it } from 'vitest'
import { createPitchAnalysis } from './analysis'
import { mpmDetector } from './mpm'
import { pitchModes } from './profiles'
import { syntheticSignals } from './syntheticSignals'
import { getChunkRange } from './workerProtocol'

const { profile, peakThreshold, lowOctaveCeilingHz } = pitchModes.bass
const detector = mpmDetector(peakThreshold, lowOctaveCeilingHz)
const signals = syntheticSignals(profile.sampleRate)

function analyze(pcm: Float32Array) {
  const analysis = createPitchAnalysis(profile, pcm.length, detector)
  analysis.append([pcm], 0, Math.ceil(pcm.length / profile.hopSize))
  return analysis.finish()
}

describe('offline pitch analysis', () => {
  it.each(['Low B', 'E1', 'A1', 'D2', 'G2', 'Weak fundamental', 'Missing fundamental'])('tracks %s with interpolated frequencies', (name) => {
    const signal = signals.find((item) => item.name === name)!
    const result = analyze(signal.pcm)
    for (const index of [20, 55, 100, 175]) {
      expect(result.hz[index]).toBeCloseTo(signal.reference(index * result.frameStep), 0)
      expect(result.confidence[index]).toBeGreaterThan(0.78)
    }
  })

  it('leaves silence, white noise and the middle of rests unvoiced', () => {
    for (const name of ['Silence', 'White noise']) {
      expect(analyze(signals.find((item) => item.name === name)!.pcm).hz.every((hz) => hz === 0)).toBe(true)
    }
    const muted = analyze(signals.find((item) => item.name === 'Muted notes and rests')!.pcm)
    expect(muted.hz[17]).toBe(0)
  })

  it('tracks the pitched part of an abruptly decaying muted note', () => {
    const pcm = Float32Array.from({ length: profile.sampleRate }, (_, index) => {
      const time = index / profile.sampleRate
      if (time >= 0.09) return 0
      const phase = 2 * Math.PI * 55 * time
      return Math.exp(-24 * time) * (0.23 * Math.sin(phase) + 0.23 * Math.sin(2 * phase))
    })
    const result = analyze(pcm)
    expect(result.hz[4]).toBeCloseTo(55, 0)
    expect(result.hz[15]).toBe(0)
  })

  it.each(['Vibrato', 'Slide'])('retains the continuous %s contour at the frame centers', (name) => {
    const signal = signals.find((item) => item.name === name)!
    const result = analyze(signal.pcm)
    expect(result.frameStep).toBe(0.01)
    for (let index = 6; index < result.hz.length - 6; index++) {
      const cents = 1200 * Math.log2(result.hz[index] / signal.reference(index * result.frameStep))
      expect(Math.abs(cents)).toBeLessThan(35)
    }
  })

  it('matches full-buffer framing across chunk boundaries and anti-phase stereo', () => {
    const pcm = signals.find((item) => item.name === 'Slide')!.pcm.subarray(0, 15_731)
    const inverted = pcm.map((sample) => -sample)
    const analysis = createPitchAnalysis(profile, pcm.length, detector)
    for (let index = 0; index < Math.ceil(pcm.length / profile.hopSize); index += 23) {
      const { offset, end, endFrame } = getChunkRange(index, pcm.length, profile.frameSize, profile.hopSize, 23)
      analysis.append([pcm.subarray(offset, end), inverted.subarray(offset, end)], offset, endFrame)
    }
    expect(analysis.finish()).toEqual(analyze(pcm))
  })

  it('preserves raw detections and corrects only an isolated octave error', () => {
    const count = profile.hopSize * 13
    const pcm = signals[0].pcm.subarray(0, count)
    let index = 0
    const estimates = [55, 55, 55, 110, 55, 55, 0, 55, 55, 110, 110, 55, 55]
    const analysis = createPitchAnalysis(profile, count, () => () => ({
      frequency: estimates[index++],
      confidence: 1,
    }))
    analysis.append([pcm], 0, estimates.length)
    const result = analysis.finish()
    expect(Array.from(result.rawHz)).toEqual(estimates)
    expect(Array.from(result.hz)).toEqual(estimates.map((value, frame) => frame === 3 ? 55 : value))
  })
})

it.each(['general', 'bass'] as const)('keeps one fundamental in %s mode when the second harmonic takes over', (mode) => {
  const { profile, peakThreshold, lowOctaveCeilingHz } = pitchModes[mode]
  const fundamental = 55
  const pcm = Float32Array.from({ length: profile.sampleRate }, (_, index) => {
    const time = index / profile.sampleRate
    const phase = 2 * Math.PI * fundamental * time
    const fundamentalLevel = time >= 0.3 && time < 0.7 ? 0.08 : 0.32
    return fundamentalLevel * Math.sin(phase) + 0.65 * Math.sin(2 * phase)
  })
  const analysis = createPitchAnalysis(profile, pcm.length, mpmDetector(peakThreshold, lowOctaveCeilingHz))
  analysis.append([pcm], 0, Math.ceil(pcm.length / profile.hopSize))
  const result = analysis.finish()

  expect(result.rawHz[50]).toBeCloseTo(110, 0)
  for (const frequency of result.hz.subarray(10, 90)) {
    expect(Math.abs(1200 * Math.log2(frequency / fundamental))).toBeLessThan(50)
  }
})

it('keeps a genuine octave note between two lower notes', () => {
  const fundamental = 55
  const pcm = Float32Array.from({ length: profile.sampleRate }, (_, index) => {
    const time = index / profile.sampleRate
    const pitch = time >= 0.3 && time < 0.7 ? 2 * fundamental : fundamental
    return 0.6 * Math.sin(2 * Math.PI * pitch * time)
  })
  const result = analyze(pcm)

  expect(result.hz[20]).toBeCloseTo(fundamental, 0)
  expect(result.hz[50]).toBeCloseTo(2 * fundamental, 0)
  expect(result.hz[80]).toBeCloseTo(fundamental, 0)
})

it('resolves a strong second harmonic at the start of a note using the later fundamental', () => {
  const fundamental = 55
  const pcm = Float32Array.from({ length: profile.sampleRate }, (_, index) => {
    const time = index / profile.sampleRate
    const phase = 2 * Math.PI * fundamental * time
    const fundamentalLevel = time < 0.25 ? 0.08 : 0.32
    return fundamentalLevel * Math.sin(phase) + 0.65 * Math.sin(2 * phase)
  })
  const result = analyze(pcm)

  expect(result.rawHz[15]).toBeCloseTo(2 * fundamental, 0)
  expect(result.hz[15]).toBeCloseTo(fundamental, 0)
})
