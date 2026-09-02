import { TICKS_PER_MEASURE, TICKS_PER_QUARTER, type PlaybackSettings, type RhythmExercise } from '../domain/rhythm'

export type PlaybackSnapshot = {
  phase: 'countIn' | 'exercise' | 'ended'
  eventIndex: number
  tick: number
  countInBeat: number
}

type ScheduledNode = AudioScheduledSourceNode

export class RhythmPlayer {
  private context: AudioContext | undefined
  private snareBuffer: AudioBuffer | undefined
  private scheduled: ScheduledNode[] = []
  private animationFrame: number | undefined
  private startedAt = 0
  private exerciseStartsAt = 0
  private pausedExerciseSeconds = 0
  private exerciseDuration = 0
  private currentEventStartSeconds = 0
  private status: 'idle' | 'playing' | 'paused' = 'idle'

  async prepare(): Promise<void> {
    this.context ??= new AudioContext()
    if (!this.snareBuffer) {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/snare.wav`)
      this.snareBuffer = await this.context.decodeAudioData(await response.arrayBuffer())
    }
  }

  async play(
    exercise: RhythmExercise,
    settings: PlaybackSettings,
    onSnapshot: (snapshot: PlaybackSnapshot) => void,
    onFinish: () => void,
    skipCountIn = false,
  ): Promise<void> {
    await this.prepare()
    const context = this.context
    if (!context || !this.snareBuffer) return
    await context.resume()
    this.cancelScheduled()

    const secondsPerTick = 60 / settings.bpm / TICKS_PER_QUARTER
    const countInTicks = this.status === 'paused' || skipCountIn ? 0 : settings.countInMeasures * TICKS_PER_MEASURE
    const startDelay = 0.08
    this.startedAt = context.currentTime + startDelay
    this.exerciseStartsAt = this.startedAt + countInTicks * secondsPerTick
    this.exerciseDuration = exercise.measures.length * TICKS_PER_MEASURE * secondsPerTick

    if (this.status !== 'paused') this.pausedExerciseSeconds = 0
    const offsetTicks = Math.round(this.pausedExerciseSeconds / secondsPerTick)
    this.status = 'playing'

    for (let tick = 0; tick < countInTicks; tick += TICKS_PER_QUARTER) {
      this.scheduleClick(this.startedAt + tick * secondsPerTick, tick % TICKS_PER_MEASURE === 0, settings.clickVolume)
    }

    exercise.measures.flatMap((measure) => measure.events).forEach((event) => {
      const absoluteTick = event.measureIndex * TICKS_PER_MEASURE + event.startTick
      if (absoluteTick < offsetTicks) return
      const when = this.exerciseStartsAt + (absoluteTick - offsetTicks) * secondsPerTick
      if (!event.rest && !event.tieStop) this.scheduleSnare(when, settings.snareVolume)
    })

    if (settings.metronome) {
      const totalTicks = exercise.measures.length * TICKS_PER_MEASURE
      for (let tick = offsetTicks; tick < totalTicks; tick += TICKS_PER_QUARTER) {
        this.scheduleClick(
          this.exerciseStartsAt + (tick - offsetTicks) * secondsPerTick,
          tick % TICKS_PER_MEASURE === 0,
          settings.clickVolume,
        )
      }
    }

    const events = exercise.measures.flatMap((measure) => measure.events)
    const update = () => {
      if (!this.context || this.status !== 'playing') return
      const now = this.context.currentTime
      if (countInTicks > 0 && now < this.exerciseStartsAt) {
        const beat = Math.max(0, Math.floor((now - this.startedAt) / (secondsPerTick * TICKS_PER_QUARTER)))
        onSnapshot({ phase: 'countIn', eventIndex: -1, tick: -1, countInBeat: beat + 1 })
      } else {
        const elapsed = now - this.exerciseStartsAt + this.pausedExerciseSeconds
        if (elapsed >= this.exerciseDuration) {
          this.status = 'idle'
          onSnapshot({ phase: 'ended', eventIndex: -1, tick: -1, countInBeat: 0 })
          onFinish()
          return
        }
        const tick = elapsed / secondsPerTick
        const eventIndex = events.findIndex((event) => {
          const start = event.measureIndex * TICKS_PER_MEASURE + event.startTick
          return tick >= start && tick < start + event.durationTicks
        })
        const activeEvent = events[eventIndex]
        if (activeEvent) {
          this.currentEventStartSeconds = (activeEvent.measureIndex * TICKS_PER_MEASURE + activeEvent.startTick) * secondsPerTick
        }
        onSnapshot({ phase: 'exercise', eventIndex, tick, countInBeat: 0 })
      }
      this.animationFrame = requestAnimationFrame(update)
    }
    this.animationFrame = requestAnimationFrame(update)
  }

  pause(): void {
    if (!this.context || this.status !== 'playing') return
    this.pausedExerciseSeconds = this.currentEventStartSeconds
    this.status = 'paused'
    this.cancelScheduled()
  }

  seek(absoluteTick: number, bpm: number): void {
    this.pausedExerciseSeconds = absoluteTick * 60 / bpm / TICKS_PER_QUARTER
    this.currentEventStartSeconds = this.pausedExerciseSeconds
    this.status = 'paused'
    this.cancelScheduled()
  }

  stop(): void {
    this.status = 'idle'
    this.pausedExerciseSeconds = 0
    this.currentEventStartSeconds = 0
    this.cancelScheduled()
  }

  isPaused(): boolean {
    return this.status === 'paused'
  }

  private scheduleSnare(when: number, volume: number): void {
    if (!this.context || !this.snareBuffer) return
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    source.buffer = this.snareBuffer
    gain.gain.value = volume
    source.connect(gain).connect(this.context.destination)
    source.start(when)
    this.scheduled.push(source)
  }

  private scheduleClick(when: number, accented: boolean, volume: number): void {
    if (!this.context) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.frequency.value = accented ? 1320 : 880
    gain.gain.setValueAtTime(volume * 0.25, when)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04)
    oscillator.connect(gain).connect(this.context.destination)
    oscillator.start(when)
    oscillator.stop(when + 0.05)
    this.scheduled.push(oscillator)
  }

  private cancelScheduled(): void {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame)
    this.animationFrame = undefined
    for (const node of this.scheduled) {
      try {
        node.stop()
      } catch {
        // A source that has already ended cannot be stopped again.
      }
    }
    this.scheduled = []
  }
}
