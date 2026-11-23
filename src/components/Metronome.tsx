import { useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  DEFAULT_BEAT_SOUNDS,
  DEFAULT_METRONOME_BPM,
  MetronomePlayer,
  type BeatSound,
  type BeatSounds,
} from '../audio/metronomePlayer'
import { MAX_BPM, MIN_BPM } from '../domain/rhythm'

const BEAT_SOUND_LABELS: Record<BeatSound, string> = {
  accent: '重拍',
  normal: '普通',
  mute: '靜音',
}

const BEAT_SOUND_STYLES: Record<BeatSound, string> = {
  accent: 'border-accent/40 bg-accent/10 text-accent-dark',
  normal: 'border-border bg-paper-light text-ink',
  mute: 'border-dashed border-border bg-transparent text-muted',
}

const NEXT_BEAT_SOUND: Record<BeatSound, BeatSound> = {
  accent: 'normal',
  normal: 'mute',
  mute: 'accent',
}

const HOLD_DURATION_MS = 450
const FIRST_REPEAT_DELAY_MS = 1000
const REPEAT_DELAY_DECREMENT_MS = 250
const MIN_REPEAT_DELAY_MS = 250

export function Metronome({ onHome }: { onHome: () => void }) {
  const [player] = useState(() => new MetronomePlayer())
  const [bpm, setBpm] = useState(DEFAULT_METRONOME_BPM)
  const [sounds, setSounds] = useState<BeatSounds>(DEFAULT_BEAT_SOUNDS)
  const [playing, setPlaying] = useState(false)
  const [activeBeat, setActiveBeat] = useState<number>()
  const [audioError, setAudioError] = useState(false)

  useEffect(() => {
    player.setSettings(bpm, sounds)
  }, [bpm, player, sounds])

  useEffect(() => () => player.stop(), [player])

  const changeBpm = (change: number) => {
    setBpm((current) => Math.min(MAX_BPM, Math.max(MIN_BPM, current + change)))
  }

  const changeBeatSound = (index: number) => {
    setSounds((current) => {
      const updated: [...BeatSounds] = [...current]
      updated[index] = NEXT_BEAT_SOUND[updated[index]]
      return updated
    })
  }

  const togglePlayback = async () => {
    if (playing) {
      player.stop()
      setPlaying(false)
      setActiveBeat(undefined)
      return
    }
    setAudioError(false)
    setPlaying(true)
    try {
      await player.start(setActiveBeat)
    } catch {
      setPlaying(false)
      setAudioError(true)
    }
  }

  return (
    <main className="mx-auto w-[min(520px,calc(100%_-_24px))] py-6 sm:py-12">
      <header className="mb-5 px-1 sm:mb-7">
        <button className="mb-4 min-h-11 text-sm font-bold text-accent-dark hover:text-accent" type="button" onClick={onHome}>← Music Tool 首頁</button>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">節拍器</h1>
          <span className="font-mono text-lg font-bold text-muted">4/4</span>
        </div>
      </header>

      <div className="rounded-[22px] border border-border bg-white/70 p-3 shadow-[0_15px_45px_rgba(62,50,37,0.07)] sm:p-6">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
          <TempoButton direction={-1} disabled={bpm <= MIN_BPM} onChange={changeBpm} />
          <div className="grid justify-items-center gap-2">
            <output className="text-[clamp(3rem,13vw,5rem)] leading-none font-semibold tabular-nums" aria-label="速度">{bpm}</output>
            <span className="text-sm font-semibold tracking-wider text-muted">BPM</span>
          </div>
          <TempoButton direction={1} disabled={bpm >= MAX_BPM} onChange={changeBpm} />
        </div>
        <p className="mt-1 text-center text-sm text-muted" id="tempo-hint">短按 ±1，長按 ±10，持續按住會加快</p>

        <section className="mt-6 border-t border-border pt-5" aria-labelledby="beat-sounds-title">
          <h2 className="mb-3 text-sm font-semibold text-muted" id="beat-sounds-title">點一下切換每拍聲音</h2>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {sounds.map((sound, index) => (
              <button
                className={`grid min-h-19 touch-manipulation place-content-center gap-1 rounded-xl border text-center ${
                  activeBeat === index
                    ? 'border-accent-dark bg-accent-dark text-white'
                    : BEAT_SOUND_STYLES[sound]
                }`}
                type="button"
                key={index}
                aria-label={`第 ${index + 1} 拍，${BEAT_SOUND_LABELS[sound]}`}
                aria-current={activeBeat === index ? 'true' : undefined}
                onClick={() => changeBeatSound(index)}
              >
                <span className="text-xl leading-none font-bold tabular-nums">{index + 1}</span>
                <span className="text-sm">{BEAT_SOUND_LABELS[sound]}</span>
              </button>
            ))}
          </div>
        </section>

        <button
          className={`mt-5 min-h-14 w-full touch-manipulation rounded-xl px-4 text-white ${playing ? 'bg-ink' : 'bg-accent-dark'}`}
          type="button"
          onClick={() => void togglePlayback()}
        >
          <span className="font-bold">{playing ? '停止' : '開始'}</span>
        </button>
        {audioError && <p className="mt-3 text-sm text-accent-dark" role="alert">無法播放聲音，請再按一次開始。</p>}
      </div>
    </main>
  )
}

function TempoButton({ direction, disabled, onChange }: {
  direction: -1 | 1
  disabled: boolean
  onChange: (amount: number) => void
}) {
  const holdTimer = useRef<number | undefined>(undefined)
  const didHold = useRef(false)
  const cancelHold = () => window.clearTimeout(holdTimer.current)

  useEffect(() => {
    if (disabled) return
    return () => window.clearTimeout(holdTimer.current)
  }, [disabled])

  const startHold = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    cancelHold()
    didHold.current = false
    let repeatDelay = FIRST_REPEAT_DELAY_MS
    const repeatChange = () => {
      didHold.current = true
      onChange(direction * 10)
      holdTimer.current = window.setTimeout(repeatChange, repeatDelay)
      repeatDelay = Math.max(MIN_REPEAT_DELAY_MS, repeatDelay - REPEAT_DELAY_DECREMENT_MS)
    }
    holdTimer.current = window.setTimeout(repeatChange, HOLD_DURATION_MS)
  }

  return (
    <button
      className="grid size-14 touch-manipulation select-none place-items-center rounded-xl border border-border bg-paper-light text-accent-dark active:bg-accent/10 disabled:cursor-default disabled:opacity-40 sm:size-17"
      type="button"
      disabled={disabled}
      aria-label={direction === 1 ? '加快速度' : '放慢速度'}
      aria-describedby="tempo-hint"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0 || !didHold.current) onChange(direction)
        didHold.current = false
      }}
    >
      <span className="text-3xl leading-none font-semibold" aria-hidden="true">{direction === 1 ? '+' : '−'}</span>
    </button>
  )
}
