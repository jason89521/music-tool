import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RhythmPlayer, type PlaybackSnapshot } from './audio/rhythmPlayer'
import { generateRhythm } from './domain/generateRhythm'
import {
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_PLAYBACK_SETTINGS,
  isValidBpm,
  type Difficulty,
  type GenerationSettings,
  type PlaybackSettings,
  type RhythmExercise,
} from './domain/rhythm'
import { loadState, saveState } from './storage'

const ScoreView = lazy(() => import('./components/ScoreView').then((module) => ({ default: module.ScoreView })))

type PlaybackStatus = 'idle' | 'playing' | 'paused'

function usePathname(): [string, (path: string) => void] {
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const navigate = (path: string) => {
    window.history.pushState({}, '', path)
    setPathname(path)
    window.scrollTo({ top: 0 })
  }
  return [pathname, navigate]
}

export default function App() {
  const [pathname, navigate] = usePathname()
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (pathname === '/rhythm-practice') {
    return <RhythmPractice onHome={() => navigate('/')} />
  }

  return (
    <main className="home-shell">
      <header className="hero">
        <p className="eyebrow">YOUR PRACTICE SPACE</p>
        <h1>Music Tool</h1>
        <p>把每一次練習，變成更清楚、更專注的進步。</p>
      </header>
      <section className="tool-grid" aria-label="音樂工具">
        <button className="tool-card" onClick={() => navigate('/rhythm-practice')}>
          <span className="tool-icon" aria-hidden="true">♩</span>
          <span>
            <strong>節奏練習器</strong>
            <small>產生、閱讀並跟奏不同節奏</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </section>
      <Credits />
      {needRefresh && (
        <div className="update-toast" role="status">
          <span>Music Tool 有新版本。</span>
          <button onClick={() => void updateServiceWorker(true)}>立即更新</button>
        </div>
      )}
    </main>
  )
}

function RhythmPractice({ onHome }: { onHome: () => void }) {
  const initial = useMemo(() => loadState(), [])
  const [generation, setGeneration] = useState<GenerationSettings>(initial?.generation ?? DEFAULT_GENERATION_SETTINGS)
  const [playback, setPlayback] = useState<PlaybackSettings>(initial?.playback ?? DEFAULT_PLAYBACK_SETTINGS)
  const [exercise, setExercise] = useState<RhythmExercise>(
    initial?.exercise ?? generateRhythm(DEFAULT_GENERATION_SETTINGS),
  )
  const [status, setStatus] = useState<PlaybackStatus>('idle')
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>({ phase: 'ended', eventIndex: -1, countInBeat: 0 })
  const [audioError, setAudioError] = useState<string>()
  const playerRef = useRef(new RhythmPlayer())
  const playbackRef = useRef(playback)
  const exerciseRef = useRef(exercise)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const bpmValid = isValidBpm(playback.bpm)

  useEffect(() => {
    playbackRef.current = playback
    exerciseRef.current = exercise
    saveState({ generation, playback, exercise })
  }, [exercise, generation, playback])

  const finish = (loopIteration = false) => {
    if (playbackRef.current.loop) {
      void playerRef.current.play(exerciseRef.current, playbackRef.current, setSnapshot, () => finish(true), true)
      setStatus('playing')
      return
    }
    setStatus('idle')
    setSnapshot({ phase: 'ended', eventIndex: -1, countInBeat: 0 })
    if (loopIteration) playerRef.current.stop()
  }

  const handlePlayPause = async () => {
    if (!bpmValid) return
    if (status === 'playing') {
      playerRef.current.pause()
      setStatus('paused')
      return
    }
    try {
      await playerRef.current.play(exercise, playback, setSnapshot, finish)
      setAudioError(undefined)
      setStatus('playing')
    } catch {
      setAudioError('無法啟動音訊，請確認瀏覽器允許播放聲音。')
    }
  }

  const handleStop = () => {
    playerRef.current.stop()
    setStatus('idle')
    setSnapshot({ phase: 'ended', eventIndex: -1, countInBeat: 0 })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLSelectElement) return
      if (event.code === 'Space') {
        event.preventDefault()
        void handlePlayPause()
      }
      if (event.code === 'Escape') handleStop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const regenerate = () => {
    handleStop()
    setExercise(generateRhythm(generation))
  }

  const reset = () => {
    if (!window.confirm('確定要重設節奏、播放設定與音量嗎？')) return
    handleStop()
    setGeneration(DEFAULT_GENERATION_SETTINGS)
    setPlayback(DEFAULT_PLAYBACK_SETTINGS)
    setExercise(generateRhythm(DEFAULT_GENERATION_SETTINGS))
  }

  const changePlayback = <K extends keyof PlaybackSettings>(key: K, value: PlaybackSettings[K]) => {
    if (key === 'bpm' && status !== 'idle') handleStop()
    setPlayback((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="practice-shell">
      <header className="topbar">
        <button className="back-button" onClick={onHome} aria-label="回到 Music Tool 首頁">←</button>
        <div><span>Music Tool</span><h1>節奏練習器</h1></div>
        <button className="text-button" onClick={reset}>重設</button>
      </header>

      <section className="settings-panel" aria-label="節奏與播放設定">
        <div className="field-group">
          <label htmlFor="difficulty">練習難度</label>
          <select id="difficulty" value={generation.difficulty} onChange={(event) => setGeneration((current) => ({ ...current, difficulty: event.target.value as Difficulty }))}>
            <option value="easy">簡單</option><option value="medium">中等</option><option value="hard">困難</option>
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="measures">小節數</label>
          <input id="measures" type="number" min="1" max="16" value={generation.measureCount} onChange={(event) => setGeneration((current) => ({ ...current, measureCount: Number(event.target.value) }))} />
        </div>
        <div className="field-group">
          <label htmlFor="bpm">播放速度 <span>BPM</span></label>
          <input id="bpm" className={!bpmValid ? 'invalid' : ''} type="number" min="20" max="400" value={playback.bpm} aria-invalid={!bpmValid} aria-describedby={!bpmValid ? 'bpm-error' : undefined} onChange={(event) => changePlayback('bpm', Number(event.target.value))} />
          {!bpmValid && <small id="bpm-error" className="error">請輸入 20–400 的整數</small>}
        </div>
        <div className="field-group">
          <label htmlFor="count-in">預備拍</label>
          <select id="count-in" value={playback.countInMeasures} onChange={(event) => changePlayback('countInMeasures', Number(event.target.value) as 1 | 2)}>
            <option value="1">1 小節</option><option value="2">2 小節</option>
          </select>
        </div>
        <label className="toggle"><input type="checkbox" checked={playback.metronome} onChange={(event) => changePlayback('metronome', event.target.checked)} /><span>節拍器</span></label>
        <label className="toggle"><input type="checkbox" checked={playback.loop} onChange={(event) => changePlayback('loop', event.target.checked)} /><span>循環播放</span></label>
        <button className="generate-button" onClick={regenerate}>產生節奏</button>
      </section>

      {snapshot.phase === 'countIn' && <div className="count-in" role="status">預備拍 · {snapshot.countInBeat}</div>}
      <Suspense fallback={<section className="score-card" aria-busy="true">正在準備樂譜⋯</section>}>
        <ScoreView exercise={exercise} activeEventIndex={snapshot.eventIndex} reduceMotion={reduceMotion} />
      </Suspense>

      <section className="transport" aria-label="播放控制">
        <button className="stop-button" onClick={handleStop} disabled={status === 'idle'} aria-label="停止">■</button>
        <button className="play-button" onClick={() => void handlePlayPause()} disabled={!bpmValid} aria-label={status === 'playing' ? '暫停' : '播放'}>
          {status === 'playing' ? 'Ⅱ' : '▶'}
        </button>
        <div className="tempo-readout"><strong>{playback.bpm}</strong><span>BPM</span></div>
      </section>

      <section className="volume-panel" aria-label="音量設定">
        <VolumeSlider label="小鼓" value={playback.snareVolume} onChange={(value) => changePlayback('snareVolume', value)} />
        <VolumeSlider label="Click" value={playback.clickVolume} onChange={(value) => changePlayback('clickVolume', value)} />
      </section>
      {audioError && <p className="error" role="alert">{audioError}</p>}
      <Credits />
    </main>
  )
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const percent = Math.round(value * 100)
  return <label className="volume"><span>{label}</span><input type="range" min="0" max="100" value={percent} aria-label={`${label}音量`} onChange={(event) => onChange(Number(event.target.value) / 100)} /><output>{percent}%</output></label>
}

function Credits() {
  return (
    <footer>
      <details><summary>關於與素材來源</summary><p>小鼓音效：<a href="https://freesound.org/people/sandyrb/sounds/38937/" target="_blank" rel="noreferrer">SBUC SNARE 005.wav</a>，作者 sandyrb，依 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> 使用；本版本使用公開預覽並經裁切、音量限制與淡出處理。</p></details>
    </footer>
  )
}
