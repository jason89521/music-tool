export type PitchProfile = {
  sampleRate: number
  frameSize: number
  hopSize: number
  minHz: number
  maxHz: number
  minClarity: number
  minRms: number
}

export type PitchDetector = (frame: Float32Array) => {
  frequency: number
  confidence: number
  octaveEvidence?: number
} | undefined
export type CreatePitchDetector = (profile: PitchProfile) => PitchDetector

export type PitchTrack = {
  frameStep: number
  // Frame i is centered at i × frameStep. Zero Hz denotes an unvoiced frame.
  rawHz: Float32Array<ArrayBuffer>
  hz: Float32Array<ArrayBuffer>
  confidence: Float32Array<ArrayBuffer>
}

export function frequencyToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440)
}
