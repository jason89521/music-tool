import { PitchDetector } from 'pitchy'
import { measureOctaveEvidence } from './octaveContinuity'
import type { CreatePitchDetector } from './types'

export function mpmDetector(peakThreshold: number, lowOctaveCeilingHz?: number): CreatePitchDetector {
  return ({ frameSize, sampleRate, minHz, maxHz, minClarity }) => {
    const detector = PitchDetector.forFloat32Array(frameSize)
    detector.clarityThreshold = peakThreshold
    return (frame) => {
      let [frequency, confidence] = detector.findPitch(frame, sampleRate)
      // A dominant second harmonic can mask a five-string bass note below E1.
      // Only prefer the stricter peak when it lands in that band, an octave lower.
      if (lowOctaveCeilingHz && frequency >= 2 * minHz && frequency < 2 * lowOctaveCeilingHz) {
        detector.clarityThreshold = 0.97
        const [lower, lowerConfidence] = detector.findPitch(frame, sampleRate)
        detector.clarityThreshold = peakThreshold
        if (lower >= minHz && lower < lowOctaveCeilingHz && Math.abs(Math.log2(frequency / lower) - 1) < 0.04) {
          frequency = lower
          confidence = lowerConfidence
        }
      }
      return {
        frequency,
        confidence,
        octaveEvidence: frequency >= minHz && frequency <= maxHz && confidence >= minClarity
          ? measureOctaveEvidence(frame, frequency, sampleRate)
          : undefined,
      }
    }
  }
}
