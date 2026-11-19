import { pitchModes, type PitchMode } from './profiles'
import type { PitchTrack } from './types'
import { getChunkRange, type PcmChunk, type PitchWorkerRequest, type PitchWorkerResponse } from './workerProtocol'

export function analyzeAudio(
  audio: AudioBuffer,
  mode: PitchMode,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<PitchTrack> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const { sampleRate, hopSize, frameSize } = pitchModes[mode].profile
    if (audio.sampleRate !== sampleRate || !audio.length || !audio.numberOfChannels) {
      throw new Error('Invalid decoded audio for pitch analysis')
    }

    const framesPerChunk = Math.ceil(sampleRate / hopSize)
    const capacity = framesPerChunk * hopSize + frameSize
    const channels = Array.from({ length: audio.numberOfChannels }, () => new Float32Array(capacity))
    const totalFrames = Math.ceil(audio.length / hopSize)
    const worker = new Worker(new URL('./pitch.worker.ts', import.meta.url), { type: 'module' })
    let nextFrame = 0

    function release() {
      signal.removeEventListener('abort', cancel)
      worker.terminate()
    }

    function cancel() {
      release()
      reject(signal.reason)
    }

    function fail() {
      release()
      reject(new Error('Pitch analysis worker failed'))
    }

    function sendChunk(buffers: PcmChunk['channels']) {
      const { offset, end, endFrame } = getChunkRange(nextFrame, audio.length, frameSize, hopSize, framesPerChunk)
      // Only one second of PCM plus overlap is copied at a time. The worker returns
      // ownership of the same buffers before the next batch; the player keeps its AudioBuffer.
      const chunk = buffers.map((buffer, index) => {
        const view = new Float32Array(buffer.buffer, 0, end - offset)
        audio.copyFromChannel(view, index, offset)
        return view
      })
      nextFrame = endFrame
      const request: PitchWorkerRequest = { type: 'chunk', channels: chunk, offset, endFrame }
      worker.postMessage(request, chunk.map((view) => view.buffer))
    }

    worker.onmessage = ({ data }: MessageEvent<PitchWorkerResponse>) => {
      if (signal.aborted) return
      if (data.type === 'complete') {
        release()
        resolve(data.track)
      } else if (data.type === 'progress') {
        try {
          onProgress(nextFrame / totalFrames)
          sendChunk(data.channels)
        } catch {
          fail()
        }
      } else {
        fail()
      }
    }
    worker.onmessageerror = fail
    worker.onerror = (event) => {
      event.preventDefault()
      fail()
    }
    signal.addEventListener('abort', cancel, { once: true })

    try {
      const request: PitchWorkerRequest = { type: 'start', mode, sampleCount: audio.length }
      worker.postMessage(request)
      sendChunk(channels)
    } catch {
      fail()
    }
  })
}
