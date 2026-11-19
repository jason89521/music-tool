import { createPitchAnalysis } from './analysis'
import { mpmDetector } from './mpm'
import { pitchModes } from './profiles'
import type { PitchWorkerRequest, PitchWorkerResponse } from './workerProtocol'

let analysis: ReturnType<typeof createPitchAnalysis> | undefined
let frameCount = 0

self.onmessage = ({ data }: MessageEvent<PitchWorkerRequest>) => {
  try {
    if (data.type === 'start') {
      const { profile, peakThreshold, lowOctaveCeilingHz } = pitchModes[data.mode]
      frameCount = Math.ceil(data.sampleCount / profile.hopSize)
      analysis = createPitchAnalysis(profile, data.sampleCount, mpmDetector(peakThreshold, lowOctaveCeilingHz))
      return
    }
    if (!analysis) throw new Error('Analysis has not started')
    analysis.append(data.channels, data.offset, data.endFrame)
    if (data.endFrame === frameCount) {
      const track = analysis.finish()
      analysis = undefined
      send({ type: 'complete', track }, [track.hz.buffer, track.rawHz.buffer, track.confidence.buffer])
    } else {
      send({ type: 'progress', channels: data.channels }, data.channels.map((channel) => channel.buffer))
    }
  } catch {
    analysis = undefined
    send({ type: 'error' }, [])
  }
}

function send(message: PitchWorkerResponse, transfer: Transferable[]) {
  self.postMessage(message, { transfer })
}
