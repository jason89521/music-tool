import type { PitchMode } from './profiles'
import type { PitchTrack } from './types'

export type PcmChunk = {
  channels: Float32Array<ArrayBuffer>[]
  offset: number
  endFrame: number
}

export type PitchWorkerRequest =
  | { type: 'start'; mode: PitchMode; sampleCount: number }
  | ({ type: 'chunk' } & PcmChunk)

export type PitchWorkerResponse =
  | { type: 'progress'; channels: PcmChunk['channels'] }
  | { type: 'complete'; track: PitchTrack }
  | { type: 'error' }

export function getChunkRange(
  nextFrame: number,
  sampleCount: number,
  frameSize: number,
  hopSize: number,
  chunkFrames: number,
) {
  const endFrame = Math.min(nextFrame + chunkFrames, Math.ceil(sampleCount / hopSize))
  const halfFrame = frameSize >> 1
  return {
    offset: Math.max(0, nextFrame * hopSize - halfFrame),
    end: Math.min(sampleCount, (endFrame - 1) * hopSize + frameSize - halfFrame),
    endFrame,
  }
}
