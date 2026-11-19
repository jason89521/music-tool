import { pitchModes, type PitchMode } from './profiles'

// Version 2 adds octave evidence from the source audio. Older tracks need reanalysis.
const analysisSchemaVersion = 2
const algorithm = 'pitchy-mpm@4.1.0'

export function pitchCacheId(songId: string, mode: PitchMode): string {
  // Each import has an immutable audio blob and its own song ID.
  const { profile, peakThreshold, lowOctaveCeilingHz } = pitchModes[mode]
  return JSON.stringify([songId, analysisSchemaVersion, algorithm, profile, peakThreshold, lowOctaveCeilingHz])
}
