import { scheduleClick } from './scheduleClick'

export type BeatSound = 'accent' | 'normal' | 'mute'
export type BeatSounds = readonly [BeatSound, BeatSound, BeatSound, BeatSound]

export const DEFAULT_METRONOME_BPM = 120
export const DEFAULT_BEAT_SOUNDS: BeatSounds = ['accent', 'normal', 'normal', 'normal']

const SCHEDULE_INTERVAL_MS = 25
const LOOKAHEAD_SECONDS = 0.09
const MINIMUM_LEAD_SECONDS = 0.02

export class MetronomePlayer {
  private context: AudioContext | undefined
  private timer: number | undefined
  private bpm = DEFAULT_METRONOME_BPM
  private sounds = DEFAULT_BEAT_SOUNDS

  setSettings(bpm: number, sounds: BeatSounds): void {
    this.bpm = bpm
    this.sounds = sounds
  }

  async start(onBeat: (index: number) => void): Promise<void> {
    if (this.context) return
    const context = new AudioContext()
    this.context = context

    try {
      await context.resume()
    } catch (error) {
      if (this.context !== context) return
      this.stop()
      throw error
    }
    if (this.context !== context) return

    let lastBeatAt: number | undefined
    let nextBeatIndex = 0
    let queuedBeat: { index: number; time: number } | undefined

    const update = () => {
      const now = context.currentTime
      if (queuedBeat && queuedBeat.time <= now) {
        onBeat(queuedBeat.index)
        queuedBeat = undefined
      }

      const nextBeatAt = lastBeatAt === undefined ? now : lastBeatAt + 60 / this.bpm
      if (nextBeatAt > now + LOOKAHEAD_SECONDS) return

      // Use the audio clock for playback and leave time for a late scheduler tick.
      const time = Math.max(nextBeatAt, now + MINIMUM_LEAD_SECONDS)
      const sound = this.sounds[nextBeatIndex]
      if (sound !== 'mute') {
        scheduleClick(context, time, sound === 'accent', sound === 'accent' ? 1 : 0.7)
      }
      queuedBeat = { index: nextBeatIndex, time }
      lastBeatAt = time
      nextBeatIndex = (nextBeatIndex + 1) % this.sounds.length
    }

    update()
    this.timer = window.setInterval(update, SCHEDULE_INTERVAL_MS)
  }

  stop(): void {
    window.clearInterval(this.timer)
    this.timer = undefined
    const context = this.context
    this.context = undefined
    if (context) void context.close()
  }
}
