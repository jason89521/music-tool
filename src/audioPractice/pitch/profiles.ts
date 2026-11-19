import type { PitchProfile } from './types'

export const ANALYSIS_SAMPLE_RATE = 8000

const general: PitchProfile = {
  sampleRate: ANALYSIS_SAMPLE_RATE,
  frameSize: 512,
  hopSize: 80,
  minHz: 28,
  maxHz: 1600,
  minClarity: 0.78,
  minRms: 0.0008,
}

type PitchModeDefinition = {
  label: string
  profile: PitchProfile
  peakThreshold: number
  lowOctaveCeilingHz?: number
}

export const pitchModes = {
  general: { label: '一般', profile: general, peakThreshold: 0.93, lowOctaveCeilingHz: undefined },
  bass: {
    label: '貝斯',
    profile: { ...general, minHz: 25, maxHz: 1200 },
    peakThreshold: 0.93,
    lowOctaveCeilingHz: 40,
  },
} satisfies Record<string, PitchModeDefinition>

export type PitchMode = keyof typeof pitchModes
export const pitchModeIds = Object.keys(pitchModes) as PitchMode[]
