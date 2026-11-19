import { track } from '@audio/pitch-pyin'
import { yinInto } from '@audio/pitch-yin'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { createPitchAnalysis } from '../src/audioPractice/pitch/analysis'
import { mpmDetector } from '../src/audioPractice/pitch/mpm'
import { pitchModes } from '../src/audioPractice/pitch/profiles'
import { syntheticSignals } from '../src/audioPractice/pitch/syntheticSignals'
import type { CreatePitchDetector, PitchProfile } from '../src/audioPractice/pitch/types'
import { getChunkRange } from '../src/audioPractice/pitch/workerProtocol'


type Signal = ReturnType<typeof syntheticSignals>[number]
type Runner = (pcm: Float32Array, profile: PitchProfile) => Float32Array

const createYinDetector: CreatePitchDetector = ({ sampleRate, frameSize, minHz, maxHz }) => {
  const parameters = Float64Array.of(sampleRate, 0.1, minHz, maxHz, 0, 0)
  const difference = new Float64Array(frameSize / 2)
  const normalized = new Float64Array(frameSize / 2)
  return (frame) => yinInto(frame, parameters, difference, normalized)
    ? { frequency: parameters[4], confidence: parameters[5] }
    : undefined
}

function frameRunner(detector: CreatePitchDetector): Runner {
  return (pcm, profile) => {
    const analysis = createPitchAnalysis(profile, pcm.length, detector)
    analysis.append([pcm], 0, Math.ceil(pcm.length / profile.hopSize))
    return analysis.finish().hz
  }
}

const runPyin: Runner = (pcm, { sampleRate, hopSize, frameSize, minHz, maxHz }) => track(pcm, {
  fs: sampleRate, hopSize, frameSize, minFreq: minHz, maxFreq: maxHz, lag: 128,
}).f0

const bassMpm = mpmDetector(0.93, 40)

const runners = {
  'MPM .93': frameRunner(mpmDetector(0.93)),
  'MPM .97': frameRunner(mpmDetector(0.97)),
  'MPM 低頻修正': frameRunner(bassMpm),
  'MPM 低頻 .70': (pcm: Float32Array, profile: PitchProfile) =>
    frameRunner(bassMpm)(pcm, { ...profile, minClarity: 0.70 }),
  'MPM 雙視窗': frameRunner((profile) => {
    const wide = bassMpm(profile)
    if (profile.frameSize <= 384) return wide
    const shortSize = 384
    const narrow = bassMpm({ ...profile, frameSize: shortSize })
    const offset = (profile.frameSize - shortSize) / 2
    return (frame) => {
      const estimate = wide(frame)
      if (estimate && estimate.confidence >= profile.minClarity
        && estimate.frequency >= profile.minHz && estimate.frequency <= profile.maxHz) return estimate
      const short = narrow(frame.subarray(offset, offset + shortSize))
      return short && short.confidence >= 0.86 ? short : estimate
    }
  }),
  YIN: frameRunner(createYinDetector),
  pYIN: runPyin,
}

type Metrics = {
  reference: number
  unvoiced: number
  voiced: number
  accurate: number
  octaveErrors: number
  falseAlarms: number
  absError: number
}

function emptyMetrics(): Metrics {
  return { reference: 0, unvoiced: 0, voiced: 0, accurate: 0, octaveErrors: 0, falseAlarms: 0, absError: 0 }
}

function score(metrics: Metrics, signal: Signal, hz: Float32Array, step: number) {
  const count = Math.ceil(signal.pcm.length / (step * pitchModes.bass.profile.sampleRate))
  for (let i = 0; i < count; i++) {
    const reference = signal.reference(i * step)
    const estimate = hz[i] ?? 0
    if (!Number.isFinite(reference)) continue
    if (!reference) {
      metrics.unvoiced++
      metrics.falseAlarms += Number(estimate > 0)
      continue
    }
    metrics.reference++
    if (!estimate) continue
    metrics.voiced++
    const cents = Math.abs(1200 * Math.log2(estimate / reference))
    metrics.absError += cents
    metrics.accurate += Number(cents <= 50)
    metrics.octaveErrors += Number(cents >= 1150 && Math.abs(cents - 1200 * Math.round(cents / 1200)) <= 50)
  }
}

function percent(count: number, total: number) {
  return total ? (100 * count / total).toFixed(1) : '—'
}

function report(signals: Signal[], sizes: number[]) {
  const rows = []
  const step = pitchModes.bass.profile.hopSize / pitchModes.bass.profile.sampleRate
  const duration = signals.reduce((sum, signal) => sum + signal.pcm.length / pitchModes.bass.profile.sampleRate, 0)
  for (const [algorithm, runner] of Object.entries(runners)) {
    for (const frameSize of sizes) {
      const profile = { ...pitchModes.bass.profile, frameSize }
      const metrics = emptyMetrics()
      const perSignal = new Map<string, Metrics>()
      let milliseconds = 0
      for (const signal of signals) {
        const start = performance.now()
        const hz = runner(signal.pcm, profile)
        milliseconds += performance.now() - start
        score(metrics, signal, hz, step)
        const detail = emptyMetrics()
        score(detail, signal, hz, step)
        perSignal.set(signal.name, detail)
      }
      const subset = (name: string) => {
        const detail = perSignal.get(name)
        return detail ? percent(detail.accurate, detail.reference) : '—'
      }
      rows.push({
        algorithm,
        frameSize,
        'RPA %': percent(metrics.accurate, metrics.reference),
        'MAE cents': (metrics.absError / metrics.voiced).toFixed(1),
        'octave %': percent(metrics.octaveErrors, metrics.voiced),
        'recall %': percent(metrics.voiced, metrics.reference),
        'false alarm %': percent(metrics.falseAlarms, metrics.unvoiced),
        'B0 %': subset('Low B'),
        'weak %': subset('Weak fundamental'),
        'missing %': subset('Missing fundamental'),
        'rapid %': subset('Rapid notes'),
        'elapsed ms': Math.round(milliseconds),
        RTF: (milliseconds / (duration * 1000)).toFixed(3),
      })
    }
  }
  console.table(rows)
  return rows
}

test('benchmark pitch accuracy and elapsed time', () => {
  const signals = syntheticSignals(pitchModes.bass.profile.sampleRate)
  for (const runner of Object.values(runners)) runner(signals[0].pcm, pitchModes.bass.profile)
  console.info(`Node ${process.version}, ${process.arch}, ${signals.length * 2}s synthetic audio`)
  const rows = report(signals, [384, 512, 768, 1024])
  expect(rows).toHaveLength(Object.keys(runners).length * 4)
})

const realDataset = process.env.IDMT_BASS_SINGLE_TRACKS

test.skipIf(!realDataset)('benchmark IDMT-SMT-Bass-Single-Track with nominal MIDI labels', () => {
  if (!realDataset) return
  const sampleRate = pitchModes.bass.profile.sampleRate
  const annotations = join(realDataset, 'annotation')
  const files = readdirSync(annotations).filter((name) => /^\d+\.xml$/.test(name)).sort()
  const signals = files.map((file): Signal => {
    const xml = readFileSync(join(annotations, file), 'utf8')
    const pcm = readPcm(join(realDataset, 'audio', file.replace(/\.xml$/, '.wav')), sampleRate)
    const events = Array.from(xml.matchAll(/<event>([\s\S]+?)<\/event>/g), ([, entry]) => {
      const tag = (name: string) => new RegExp(`<${name}>([^<]+)</${name}>`).exec(entry)?.[1]
      return {
        start: Number(tag('onsetSec')),
        end: Number(tag('offsetSec')),
        hz: tag('expressionStyle') === 'NO' ? 440 * 2 ** ((Number(tag('pitch')) - 69) / 12) : NaN,
      }
    })
    return {
      name: file,
      pcm,
      reference(time) {
        const interior = events.find(({ start, end }) => time >= start + 0.04 && time <= end - 0.04)
        if (interior) return interior.hz
        return events.some(({ start, end }) => time >= start - 0.04 && time <= end + 0.04) ? NaN : 0
      },
    }
  })
  expect(signals.length).toBeGreaterThan(0)
  console.info(`IDMT-SMT-Bass-Single-Track, ${signals.length} tracks, ${Math.round(signals.reduce((total, signal) => total + signal.pcm.length / sampleRate, 0))}s`)
  report(signals, [512, 768])
})

function readPcm(path: string, sampleRate: number): Float32Array {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', path, '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-',
  ], { maxBuffer: 32 * 1024 * 1024 })
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
}

const isolatedDataset = process.env.IDMT_BASS_ISOLATED

test.skipIf(!isolatedDataset)('benchmark a stratified sample of IDMT-SMT-Bass isolated notes', () => {
  if (!isolatedDataset) return
  const sampleRate = pitchModes.bass.profile.sampleRate
  const sampleDir = join(isolatedDataset, 'PS')
  const signals = ['FS', 'MU', 'PK', 'SP', 'ST'].flatMap((style) => {
    const directory = join(sampleDir, style)
    return readdirSync(directory).filter((file) => /^BS_1_EQ_1_\w\w_NO_[1-4]_[05]\.wav$/.test(file)).sort().map((file): Signal => {
      const [string, fret] = file.replace('.wav', '').split('_').slice(-2).map(Number)
      const hz = 440 * 2 ** (([28, 33, 38, 43][string - 1] + fret - 69) / 12)
      const pcm = readPcm(join(directory, file), sampleRate)
      const hop = sampleRate / 100
      const energy = Array.from({ length: Math.floor(pcm.length / hop) }, (_, index) => {
        let power = 0
        for (let i = index * hop; i < (index + 1) * hop; i++) power += pcm[i] ** 2
        return power
      })
      const peak = Math.max(...energy)
      const onset = energy.findIndex((power) => power >= peak * 0.02)
      return {
        name: file,
        pcm,
        reference(time) {
          const frame = Math.round(time * 100)
          return frame >= onset + 7 && frame < onset + 24 && energy[frame] >= peak * 0.005 ? hz : NaN
        },
      }
    })
  })
  expect(signals).toHaveLength(40)
  console.info('IDMT-SMT-Bass, 40 isolated clips')
  report(signals, [512, 768])
})

test.skipIf(!process.env.PITCH_BENCH_LONG)('benchmark 30 minutes of mono PCM in reusable chunks', () => {
  const { profile, peakThreshold, lowOctaveCeilingHz } = pitchModes.bass
  const sampleCount = profile.sampleRate * 1800
  const totalFrames = Math.ceil(sampleCount / profile.hopSize)
  const analysis = createPitchAnalysis(profile, sampleCount, mpmDetector(peakThreshold, lowOctaveCeilingHz))
  const channels = [new Float32Array(profile.sampleRate + profile.frameSize)]
  const start = performance.now()
  for (let i = 0; i < totalFrames; i += 100) {
    const { offset, end, endFrame } = getChunkRange(i, sampleCount, profile.frameSize, profile.hopSize, 100)
    const pcm = channels[0].subarray(0, end - offset)
    for (let j = 0; j < pcm.length; j++) pcm[j] = 0.4 * Math.sin(2 * Math.PI * 41.2 * (j + offset) / profile.sampleRate)
    analysis.append([pcm], offset, endFrame)
  }
  expect(analysis.finish().hz).toHaveLength(totalFrames)
  const milliseconds = performance.now() - start
  console.info({
    durationSeconds: 1800,
    frames: totalFrames,
    milliseconds: Math.round(milliseconds),
    RTF: milliseconds / 1000 / 1800,
    peakProcessRSSMiB: process.resourceUsage().maxRSS / 1024,
  })
})
