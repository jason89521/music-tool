const contourToleranceRatio = 2 ** 0.06

export const octaveEvidence = {
  lower: 1,
  primary: 2,
} as const

export function measureOctaveEvidence(frame: Float32Array, frequency: number, sampleRate: number): number {
  const period = sampleRate / frequency
  const lowerPeriod = 2 * period
  const lowerLength = frame.length - Math.ceil(lowerPeriod) - 2
  const canCompareLower = lowerLength >= Math.max(40, 0.7 * lowerPeriod)
  const length = canCompareLower ? lowerLength : frame.length - Math.ceil(period) - 2
  if (length < 40) return 0

  // Use centered windows of the same length so a decaying note does not get
  // more support merely because a longer lag uses fewer samples.
  const primary = periodicity(frame, period, length)
  const half = periodicity(frame, period / 2, length)
  const reliablePrimary = primary >= 0.86 && primary - half >= 0.10
  const lower = canCompareLower ? periodicity(frame, lowerPeriod, length) : 0
  const supportedLower = lower >= 0.95 && lower - primary >= 0.02
  return (reliablePrimary ? octaveEvidence.primary : 0) | (supportedLower ? octaveEvidence.lower : 0)
}

function periodicity(frame: Float32Array, lag: number, length: number): number {
  const start = (frame.length - length - lag) / 2
  const left = Math.floor(start)
  const right = Math.floor(start + lag)
  const leftFraction = start - left
  const rightFraction = start + lag - right
  let cross = 0
  let energy = 0
  for (let i = 0; i < length; i++) {
    const a = frame[left + i] + leftFraction * (frame[left + i + 1] - frame[left + i])
    const b = frame[right + i] + rightFraction * (frame[right + i + 1] - frame[right + i])
    cross += a * b
    energy += a * a + b * b
  }
  return energy ? 2 * cross / energy : 0
}

export function resolveOctaveRuns(
  rawHz: Float32Array,
  hz: Float32Array,
  evidence: Uint8Array,
  frameStep: number,
) {
  const anchorFrames = Math.ceil(0.05 / frameStep)
  let first = 0
  while (first < rawHz.length) {
    const pitch = rawHz[first]
    if (!pitch) {
      first++
      continue
    }
    let end = first + 1
    let support = evidence[first] & octaveEvidence.lower
    while (end < rawHz.length && nearPitch(rawHz[end], pitch)) {
      support += evidence[end] & octaveEvidence.lower
      end++
    }

    if (support) {
      const before = isAnchor(first - 1, -1, pitch / 2)
      const after = isAnchor(end, 1, rawHz[end - 1] / 2)
      const duration = (end - first) * frameStep
      const both = before && after
      // A lower continuation and a repeated acoustic period are independent
      // evidence. Require stronger evidence when the continuation is one-sided.
      if ((before || after) && duration >= 0.03 && duration <= (both ? 0.6 : 0.35)
        && support / (end - first) >= (both ? 0.65 : 0.8)) {
        for (let i = first; i < end; i++) hz[i] = rawHz[i] / 2
      }
    }

    first = end
  }

  function isAnchor(edge: number, direction: number, reference: number): boolean {
    let support = 0
    for (let offset = 0; offset < anchorFrames; offset++) {
      const index = edge + direction * offset
      if (!nearPitch(rawHz[index], reference)) break
      if (evidence[index] & octaveEvidence.primary) support++
      if (support >= 2) return true
    }
    return false
  }
}

function nearPitch(frequency: number, reference: number): boolean {
  return frequency > reference / contourToleranceRatio && frequency < reference * contourToleranceRatio
}
