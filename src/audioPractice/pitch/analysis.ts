import { resolveOctaveRuns } from './octaveContinuity'
import type { CreatePitchDetector, PitchProfile, PitchTrack } from './types'

export function createPitchAnalysis(profile: PitchProfile, sampleCount: number, createDetector: CreatePitchDetector) {
  const { sampleRate, frameSize, hopSize, minHz, maxHz, minClarity, minRms } = profile
  const count = Math.ceil(sampleCount / hopSize)
  const halfFrame = frameSize >> 1
  const gateRadius = Math.min(hopSize, halfFrame)
  const frame = new Float32Array(frameSize)
  const detect = createDetector(profile)
  const rawHz = new Float32Array(count)
  const confidence = new Float32Array(count)
  const octaveEvidence = new Uint8Array(count)
  let nextFrame = 0

  // Chunks carry overlapping context so frames keep the same geometry at chunk boundaries.
  function append(channels: Float32Array[], offset: number, endFrame: number) {
    for (; nextFrame < endFrame; nextFrame++) {
      const start = nextFrame * hopSize - halfFrame
      const first = Math.max(0, offset - start)
      const last = Math.min(frameSize, offset + channels[0].length - start)
      prepareFrame(frame, channels, start - offset, first, last)

      let energy = 0
      let centerEnergy = 0
      for (let i = first; i < last; i++) {
        const power = frame[i] * frame[i]
        energy += power
        if (i >= halfFrame - gateRadius && i < halfFrame + gateRadius) centerEnergy += power
      }
      const centerPower = centerEnergy / (2 * gateRadius)
      // Broad frames can overlap a note while their timestamp falls in a rest.
      if (centerPower < Math.max(minRms ** 2, 0.02 * energy / frameSize)) continue

      const estimate = detect(frame)
      if (!estimate || estimate.frequency < minHz || estimate.frequency > maxHz) continue
      if (!Number.isFinite(estimate.frequency) || !Number.isFinite(estimate.confidence)) continue
      confidence[nextFrame] = Math.max(0, Math.min(1, estimate.confidence))
      if (estimate.confidence >= minClarity) {
        rawHz[nextFrame] = estimate.frequency
        octaveEvidence[nextFrame] = estimate.octaveEvidence ?? 0
      }
    }
  }

  function finish(): PitchTrack {
    if (nextFrame !== count) throw new Error('Incomplete pitch analysis')
    const hz = rawHz.slice()
    for (let i = 2; i + 2 < count; i++) {
      const previous = rawHz[i - 1]
      const current = rawHz[i]
      if (!previous || !current || !rawHz[i - 2] || !rawHz[i + 1] || !rawHz[i + 2]) continue
      const reference = Math.sqrt(previous * rawHz[i + 1])
      const octaveShift = Math.round(Math.log2(current / reference))
      const corrected = current / 2 ** octaveShift
      // Only fix isolated octave jumps surrounded by a stable contour.
      if (Math.abs(octaveShift) === 1
        && Math.abs(Math.log2(previous / rawHz[i + 1])) < 0.04
        && Math.abs(Math.log2(previous / rawHz[i - 2])) < 0.04
        && Math.abs(Math.log2(rawHz[i + 1] / rawHz[i + 2])) < 0.04
        && Math.abs(Math.log2(corrected / reference)) < 0.04) {
        hz[i] = corrected
      }
    }
    const frameStep = hopSize / sampleRate
    resolveOctaveRuns(rawHz, hz, octaveEvidence, frameStep)
    return { frameStep, rawHz, hz, confidence }
  }

  return { append, finish }
}

function prepareFrame(
  frame: Float32Array,
  channels: Float32Array[],
  offset: number,
  first: number,
  last: number,
) {
  frame.fill(0)
  if (channels.length === 1) {
    frame.set(channels[0].subarray(offset + first, offset + last), first)
  } else {
    for (const channel of channels) {
      for (let i = first; i < last; i++) frame[i] += channel[offset + i] / channels.length
    }

    // Fall back to the strongest channel when downmixing cancels the signal.
    const energy = varianceSum(frame, first, last)
    let bestEnergy = energy * 8
    let bestChannel: Float32Array | undefined
    for (const channel of channels) {
      const channelEnergy = varianceSum(channel, offset + first, offset + last)
      if (channelEnergy > bestEnergy) {
        bestEnergy = channelEnergy
        bestChannel = channel
      }
    }
    if (bestChannel) frame.set(bestChannel.subarray(offset + first, offset + last), first)
  }

  let sum = 0
  for (let i = first; i < last; i++) sum += frame[i]
  const mean = sum / (last - first)
  for (let i = first; i < last; i++) frame[i] -= mean
}

function varianceSum(samples: Float32Array, first: number, last: number): number {
  let sum = 0
  let squares = 0
  for (let i = first; i < last; i++) {
    const sample = samples[i]
    sum += sample
    squares += sample * sample
  }
  return squares - sum ** 2 / (last - first)
}
