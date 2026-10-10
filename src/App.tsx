import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RhythmPlayer, type PlaybackSnapshot } from './audio/rhythmPlayer'
import { generateRhythm } from './domain/generateRhythm'
import {
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_PLAYBACK_SETTINGS,
  isValidBpm,
  type GenerationSettings,
  type PlaybackSettings,
  type RhythmExercise,
  type RhythmMaterial,
} from './domain/rhythm'
import { loadState, saveState } from './storage'
import { shouldShowInstallBanner, usePwaInstall } from './pwaInstall'
import type { ScorePlaybackTarget } from './score/toMusicXml'
import { ChordReference } from './components/ChordReference'

const ScoreView = lazy(() => import('./components/ScoreView').then((module) => ({ default: module.ScoreView })))
const AudioPractice = lazy(() => import('./components/AudioPractice').then((module) => ({ default: module.AudioPractice })))

type PlaybackStatus = 'idle' | 'playing' | 'paused'
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

function usePathname(): [string, (path: string) => void] {
  const currentPath = () => window.location.pathname.slice(basePath.length) || '/'
  const [pathname, setPathname] = useState(currentPath)
  useEffect(() => {
    const onPopState = () => setPathname(currentPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const navigate = (path: string) => {
    window.history.pushState({}, '', `${basePath}${path}`)
    setPathname(path)
    window.scrollTo({ top: 0 })
  }
  return [pathname, navigate]
}

export default function App() {
  const [pathname, navigate] = usePathname()
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const { canInstall, showBanner, dismissBanner, requestInstall } = usePwaInstall()

  const installButton = canInstall
    ? <button className="whitespace-nowrap rounded-full border border-accent bg-transparent px-[14px] py-2 text-[.85rem] font-bold text-accent-dark" onClick={() => void requestInstall()}>安裝 App</button>
    : null

  return (
    <>
      {pathname === '/rhythm-practice'
        ? <RhythmPractice onHome={() => navigate('/')} installButton={installButton} />
        : pathname === '/chords'
          ? <ChordReference onHome={() => navigate('/')} />
          : pathname === '/audio-practice'
            ? <Suspense fallback={<main className="mx-auto min-h-screen w-[min(1440px,calc(100%_-_32px))] py-8">載入音源練習器…</main>}><AudioPractice onHome={() => navigate('/')} /></Suspense>
          : (
            <main className="mx-auto w-[min(1440px,calc(100%_-_32px))] pt-[72px] pb-8 max-[560px]:w-[min(1440px,calc(100%_-_20px))] max-[560px]:pt-8">
            <header className="max-w-[760px] py-[52px] max-[560px]:px-2 max-[560px]:py-9">
              <div className="flex min-h-[38px] items-center justify-between gap-5">
                <p className="text-[.78rem] font-bold tracking-[.18em] text-accent">YOUR PRACTICE SPACE</p>
                {installButton}
              </div>
              <h1 className="mt-2 mb-3 text-[clamp(3.5rem,9vw,7rem)] leading-[0.95] tracking-[-0.065em] text-[#171a21]">Music Tool</h1>
              <p className="text-[1.15rem] text-[#5e6065]">把每一次練習，變成更清楚、更專注的進步。</p>
            </header>
            <section className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-[18px]" aria-label="音樂工具">
              <button className="grid min-h-[148px] grid-cols-[auto_1fr_auto] items-center gap-[18px] rounded-[22px] border border-border bg-white/70 p-6 text-left text-inherit shadow-[0_15px_45px_rgba(62,50,37,0.07)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_55px_rgba(62,50,37,0.13)]" onClick={() => navigate('/rhythm-practice')}>
                <span className="grid size-16 place-items-center rounded-[18px] bg-accent text-[2rem] text-white" aria-hidden="true">♩</span>
                <span>
                  <strong className="mb-1 block text-xl">節奏練習器</strong>
                  <small className="block text-[#6b6c70]">產生、閱讀並跟奏不同節奏</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <button className="grid min-h-[148px] grid-cols-[auto_1fr_auto] items-center gap-[18px] rounded-[22px] border border-border bg-white/70 p-6 text-left text-inherit shadow-[0_15px_45px_rgba(62,50,37,0.07)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_55px_rgba(62,50,37,0.13)]" onClick={() => navigate('/chords')}>
                <span className="grid size-16 place-items-center rounded-[18px] bg-accent text-[2rem] text-white" aria-hidden="true">♬</span>
                <span>
                  <strong className="mb-1 block text-xl">和弦表</strong>
                  <small className="block text-[#6b6c70]">查看 12 個調的和弦組成音與音程結構</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <button className="grid min-h-[148px] grid-cols-[auto_1fr_auto] items-center gap-[18px] rounded-[22px] border border-border bg-white/70 p-6 text-left text-inherit shadow-[0_15px_45px_rgba(62,50,37,0.07)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_55px_rgba(62,50,37,0.13)]" onClick={() => navigate('/audio-practice')}>
                <span className="grid size-16 place-items-center rounded-[18px] bg-accent text-[2rem] text-white" aria-hidden="true">♫</span>
                <span>
                  <strong className="mb-1 block text-xl">音源練習器</strong>
                  <small className="block text-[#6b6c70]">匯入音源、儲存段落並循環練習</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </section>
            <Credits />
          </main>
        )}
      {needRefresh && (
        <div className="fixed right-5 bottom-5 flex items-center gap-4 rounded-xl bg-[#171a21] px-[18px] py-[14px] text-white shadow-[0_15px_35px_rgba(0,0,0,0.22)] max-[560px]:right-[10px] max-[560px]:bottom-[10px] max-[560px]:w-[calc(100%_-_20px)] max-[560px]:justify-between" role="status">
          <span>Music Tool 有新版本。</span>
          <button className="rounded-lg border-0 bg-accent px-3 py-2 text-white" onClick={() => void updateServiceWorker(true)}>立即更新</button>
        </div>
      )}
      {shouldShowInstallBanner(showBanner, needRefresh) && (
        <aside className="fixed right-5 bottom-5 w-[min(420px,calc(100%_-_40px))] rounded-[14px] bg-[#171a21] p-[18px] text-white shadow-[0_15px_35px_rgba(0,0,0,0.22)] max-[560px]:right-[10px] max-[560px]:bottom-[10px] max-[560px]:w-[calc(100%_-_20px)]" aria-label="安裝 Music Tool">
          <p className="mb-[14px] leading-normal">將音樂工具安裝到桌面，離線也能快速開啟。</p>
          <div className="flex justify-end gap-[10px]">
            <button className="rounded-lg border-0 bg-transparent px-[14px] py-[9px] font-bold text-[#e8e3db]" onClick={dismissBanner}>稍後</button>
            <button className="rounded-lg border-0 bg-accent px-[14px] py-[9px] font-bold text-white" onClick={() => void requestInstall()}>安裝 App</button>
          </div>
        </aside>
      )}
    </>
  )
}

function RhythmPractice({ onHome, installButton }: { onHome: () => void; installButton: React.ReactNode }) {
  const initial = useMemo(() => loadState(), [])
  const [generation, setGeneration] = useState<GenerationSettings>(initial?.generation ?? DEFAULT_GENERATION_SETTINGS)
  const [playback, setPlayback] = useState<PlaybackSettings>(initial?.playback ?? DEFAULT_PLAYBACK_SETTINGS)
  const [exercise, setExercise] = useState<RhythmExercise>(
    initial?.exercise ?? generateRhythm(DEFAULT_GENERATION_SETTINGS),
  )
  const [status, setStatus] = useState<PlaybackStatus>('idle')
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>({
    phase: 'ended',
    eventIndex: -1,
    tick: -1,
    countInBeat: 0,
  })
  const [audioError, setAudioError] = useState<string>()
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
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

  useEffect(() => {
    if (!advancedSettingsOpen) return
    const onPopState = () => setAdvancedSettingsOpen(false)
    window.addEventListener('popstate', onPopState)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('popstate', onPopState)
      document.body.classList.remove('modal-open')
    }
  }, [advancedSettingsOpen])

  const openAdvancedSettings = () => {
    window.history.pushState({ advancedSettings: true }, '')
    setAdvancedSettingsOpen(true)
  }

  const closeAdvancedSettings = () => {
    if (window.history.state?.advancedSettings) window.history.back()
    else setAdvancedSettingsOpen(false)
  }

  const finish = (loopIteration = false) => {
    if (playbackRef.current.loop) {
      void playerRef.current.play(exerciseRef.current, playbackRef.current, setSnapshot, () => finish(true), true)
      setStatus('playing')
      return
    }
    setStatus('idle')
    setSnapshot({ phase: 'ended', eventIndex: -1, tick: -1, countInBeat: 0 })
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
    setSnapshot({ phase: 'ended', eventIndex: -1, tick: -1, countInBeat: 0 })
  }

  const handleManualPositionChange = ({ sourceEventIndex, tick }: ScorePlaybackTarget) => {
    if (status === 'playing') return
    playerRef.current.seek(tick, playback.bpm)
    setStatus('paused')
    setSnapshot({ phase: 'exercise', eventIndex: sourceEventIndex, tick, countInBeat: 0 })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && advancedSettingsOpen) {
        event.preventDefault()
        closeAdvancedSettings()
        return
      }
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
    setIsGenerating(true)
    window.requestAnimationFrame(() => {
      setExercise(generateRhythm(generation))
      setIsGenerating(false)
    })
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
    <main className="mx-auto grid h-dvh w-[min(1440px,calc(100%_-_32px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden px-0 pt-[max(12px,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] max-[560px]:w-full max-[560px]:px-[10px]">
      <header className="flex min-w-0 items-stretch gap-2 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[560px]:gap-[6px] max-[360px]:gap-1" aria-label="播放與基礎設定">
        <button className={`grid size-[62px] min-h-[58px] shrink-0 place-items-center rounded-[13px] border p-[6px] text-[1.15rem] shadow-[0_7px_20px_rgba(62,50,37,0.06)] max-[560px]:size-[50px] max-[560px]:min-h-[54px] max-[560px]:rounded-[11px] max-[360px]:size-[45px] max-[360px]:min-h-[54px] ${bpmValid ? 'border-accent bg-accent text-white shadow-[0_9px_22px_rgba(213,84,53,0.2)]' : 'border-[#d8d0c4] bg-[#fffdf9]/[.82] text-[#33353a]'} disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => void handlePlayPause()} disabled={!bpmValid} aria-label={status === 'playing' ? '暫停' : '播放'}>
          {status === 'playing' ? 'Ⅱ' : '▶'}
        </button>
        <button className="grid size-[62px] min-h-[58px] shrink-0 place-items-center rounded-[13px] border border-[#d8d0c4] bg-[#fffdf9]/[.82] p-[6px] text-[1.15rem] text-[#33353a] shadow-[0_7px_20px_rgba(62,50,37,0.06)] disabled:cursor-not-allowed disabled:opacity-40 max-[560px]:size-[50px] max-[560px]:min-h-[54px] max-[560px]:rounded-[11px] max-[360px]:size-[45px]" onClick={handleStop} disabled={status === 'idle'} aria-label="完全停止">■</button>
        <label className="grid h-[58px] w-[62px] shrink-0 grid-rows-[auto_1fr] place-items-center rounded-[13px] border border-[#d8d0c4] bg-[#fffdf9]/[.82] px-[5px] pt-[6px] pb-1 text-[#33353a] shadow-[0_7px_20px_rgba(62,50,37,0.06)] max-[560px]:h-[54px] max-[560px]:w-[58px] max-[560px]:rounded-[11px] max-[360px]:w-[55px]">
          <span className="text-[.61rem] font-extrabold tracking-[.08em] text-[#8b8276]">BPM</span>
          <input className={`w-full min-w-0 appearance-none border-0 bg-transparent text-center text-[1.17rem] font-extrabold text-inherit outline-none ${!bpmValid ? 'text-[#a12e22]' : ''}`} type="number" min="20" max="400" value={playback.bpm} aria-label="播放速度 BPM" aria-invalid={!bpmValid} onChange={(event) => changePlayback('bpm', Number(event.target.value))} />
        </label>
        <button className={`grid h-[58px] w-[62px] shrink-0 grid-rows-[1fr_auto] place-items-center gap-px rounded-[13px] border p-[6px] text-[1.15rem] shadow-[0_7px_20px_rgba(62,50,37,0.06)] max-[560px]:h-[54px] max-[560px]:w-[50px] max-[560px]:rounded-[11px] max-[360px]:w-[45px] ${playback.metronome ? 'border-accent bg-accent text-white' : 'border-[#d8d0c4] bg-[#fffdf9]/[.82] text-[#33353a]'}`} type="button" aria-label="節拍器" aria-pressed={playback.metronome} onClick={() => changePlayback('metronome', !playback.metronome)}>
          <span aria-hidden="true">♩</span><small className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[.62rem] leading-none">節拍器</small>
        </button>
        <button className={`grid h-[58px] w-[62px] shrink-0 grid-rows-[1fr_auto] place-items-center gap-px rounded-[13px] border p-[6px] text-[1.15rem] shadow-[0_7px_20px_rgba(62,50,37,0.06)] max-[560px]:h-[54px] max-[560px]:w-[50px] max-[560px]:rounded-[11px] max-[360px]:w-[45px] ${playback.loop ? 'border-accent bg-accent text-white' : 'border-[#d8d0c4] bg-[#fffdf9]/[.82] text-[#33353a]'}`} type="button" aria-label="循環播放" aria-pressed={playback.loop} onClick={() => changePlayback('loop', !playback.loop)}>
          <span aria-hidden="true">↻</span><small className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[.62rem] leading-none">Loop</small>
        </button>
        <button className="ml-auto grid size-[62px] min-h-[58px] shrink-0 place-items-center rounded-[13px] border border-[#d8d0c4] bg-[#fffdf9]/[.82] p-[6px] text-[1.3rem] text-[#33353a] shadow-[0_7px_20px_rgba(62,50,37,0.06)] max-[560px]:size-[50px] max-[560px]:min-h-[54px] max-[560px]:rounded-[11px] max-[360px]:size-[45px]" onClick={openAdvancedSettings} aria-label="進階設定" aria-haspopup="dialog">⚙</button>
      </header>

      <section className="relative min-h-0 overflow-hidden px-1 pt-3 pb-6 max-[560px]:pt-[10px]" aria-label="可捲動的節奏內容">
        <div
          className={`pointer-events-none absolute top-1/2 left-1/2 z-[2] w-max -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-4 py-2 font-bold text-white ${snapshot.phase === 'countIn' ? 'visible' : 'invisible'}`}
          role="status"
          aria-hidden={snapshot.phase !== 'countIn'}
        >
          預備拍 · {snapshot.countInBeat}
        </div>
        <Suspense fallback={<section className="h-full overflow-hidden rounded-[20px] bg-white p-2 shadow-[0_14px_50px_rgba(55,46,37,0.09)] max-[560px]:rounded-2xl" aria-busy="true">正在準備樂譜⋯</section>}>
          <ScoreView
            exercise={exercise}
            activeEventIndex={snapshot.eventIndex}
            activeTick={snapshot.tick}
            isPlaying={status === 'playing'}
            onManualPositionChange={handleManualPositionChange}
            reduceMotion={reduceMotion}
          />
        </Suspense>
        {audioError && <p className="text-[.78rem] text-[#a12e22]" role="alert">{audioError}</p>}
      </section>

      <footer className="border-t border-border bg-[#f4efe6]/[.94] px-1 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <button className="min-h-[54px] w-full rounded-[14px] border-0 bg-accent px-5 text-[1.05rem] font-extrabold tracking-[.02em] text-white shadow-[0_10px_25px_rgba(213,84,53,0.22)] disabled:cursor-progress disabled:opacity-65" onClick={regenerate} disabled={isGenerating}>
          {isGenerating ? '產生中…' : '產生節奏'}
        </button>
      </footer>
      {advancedSettingsOpen && (
        <AdvancedSettingsDialog
          generation={generation}
          playback={playback}
          bpmValid={bpmValid}
          installButton={installButton}
          selectedMaterials={generation.selectedMaterials}
          onGenerationChange={setGeneration}
          onPlaybackChange={changePlayback}
          onChange={(selectedMaterials) => setGeneration((current) => ({ ...current, selectedMaterials }))}
          onReset={reset}
          onHome={onHome}
          onClose={closeAdvancedSettings}
        />
      )}
    </main>
  )
}

const MATERIAL_OPTIONS: ReadonlyArray<{ material: RhythmMaterial; label: string; symbol: string }> = [
  { material: 'quarter', label: '四分音符', symbol: '♩' },
  { material: 'eighth', label: '八分音符', symbol: '♪' },
  { material: 'sixteenth', label: '十六分音符', symbol: '♬' },
  { material: 'eighthTriplet', label: '八分三連音', symbol: '♪³' },
  { material: 'quarterTriplet', label: '四分三連音', symbol: '♩³' },
]

function AdvancedSettingsDialog({
  generation,
  playback,
  bpmValid,
  installButton,
  selectedMaterials,
  onGenerationChange,
  onPlaybackChange,
  onChange,
  onReset,
  onHome,
  onClose,
}: {
  generation: GenerationSettings
  playback: PlaybackSettings
  bpmValid: boolean
  installButton: React.ReactNode
  selectedMaterials: RhythmMaterial[]
  onGenerationChange: React.Dispatch<React.SetStateAction<GenerationSettings>>
  onPlaybackChange: <K extends keyof PlaybackSettings>(key: K, value: PlaybackSettings[K]) => void
  onChange: (selectedMaterials: RhythmMaterial[]) => void
  onReset: () => void
  onHome: () => void
  onClose: () => void
}) {
  const [selectionHint, setSelectionHint] = useState<string>()
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const toggleMaterial = (material: RhythmMaterial) => {
    if (selectedMaterials.includes(material)) {
      if (selectedMaterials.length === 1) {
        setSelectionHint('請至少保留一種節奏素材。')
        return
      }
      onChange(selectedMaterials.filter((selected) => selected !== material))
    } else {
      onChange([...selectedMaterials, material])
    }
    setSelectionHint(undefined)
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-[#171a21]/[.58] p-6 backdrop-blur-[5px] max-[560px]:place-items-stretch max-[560px]:bg-[#fffdf9] max-[560px]:p-0" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="grid max-h-[min(840px,calc(100dvh_-_48px))] w-[min(720px,100%)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-[#d8d0c4] bg-[#fffdf9] p-7 shadow-[0_28px_80px_rgba(23,26,33,0.28)] max-[560px]:min-h-dvh max-[560px]:max-h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0 max-[560px]:px-5 max-[560px]:pt-[max(20px,env(safe-area-inset-top))] max-[560px]:pb-[max(20px,env(safe-area-inset-bottom))] max-[560px]:shadow-none" role="dialog" aria-modal="true" aria-labelledby="advanced-settings-title">
        <header className="flex items-center justify-between gap-5 border-b border-border pb-[18px]">
          <div>
            <p className="mb-[5px] text-[.72rem] font-extrabold tracking-[.16em] text-accent">SETTINGS</p>
            <h2 className="m-0 text-[1.65rem] outline-none" id="advanced-settings-title" ref={titleRef} tabIndex={-1}>進階設定</h2>
          </div>
          <button className="size-11 rounded-full border-0 bg-transparent text-[2rem] leading-none text-[#5f5b56] hover:bg-[#f1ebe2]" onClick={onClose} aria-label="關閉進階設定">×</button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          <section className="border-b border-border py-[22px] last:border-b-0" aria-labelledby="rhythm-settings-title">
            <h3 className="mb-4 mt-0 text-base" id="rhythm-settings-title">節奏內容</h3>
            <div className="grid grid-cols-2 gap-[14px]">
              <div>
                <label className="mb-[7px] block text-[.78rem] font-bold text-[#655f58]" htmlFor="measures">小節數</label>
                <input className="h-11 w-full rounded-[10px] border border-[#cfc6b9] bg-[#fffdf9] px-3 text-ink" id="measures" type="number" min="1" max="16" value={generation.measureCount} onChange={(event) => onGenerationChange((current) => ({ ...current, measureCount: Number(event.target.value) }))} />
              </div>
              <div>
                <label className="mb-[7px] block text-[.78rem] font-bold text-[#655f58]" htmlFor="count-in">預備拍</label>
                <select className="h-11 w-full rounded-[10px] border border-[#cfc6b9] bg-[#fffdf9] px-3 text-ink" id="count-in" value={playback.countInMeasures} onChange={(event) => onPlaybackChange('countInMeasures', Number(event.target.value) as 1 | 2)}>
                  <option value="1">1 小節</option><option value="2">2 小節</option>
                </select>
              </div>
            </div>
            <p className="my-5 mb-[14px] text-muted">選擇練習中可以出現的節奏素材</p>
            <div className="grid grid-cols-5 gap-3 max-[560px]:grid-cols-2" aria-label="可出現的節奏素材">
          {MATERIAL_OPTIONS.map(({ material, label, symbol }) => {
            const selected = selectedMaterials.includes(material)
            return (
              <button
                key={material}
                className={`flex min-h-[136px] flex-col items-center justify-center gap-3 rounded-2xl border px-2 py-4 text-[.82rem] font-bold transition-[transform,border-color,background] duration-150 hover:-translate-y-0.5 hover:border-[#baaa9b] max-[560px]:min-h-[126px] ${selected ? 'border-accent bg-accent text-white shadow-[0_9px_22px_rgba(213,84,53,0.2)]' : 'border-[#d6cec2] bg-[#f7f2ea] text-[#56534f]'}`}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleMaterial(material)}
              >
                <span className="grid min-h-12 place-items-center font-serif text-[2.5rem] leading-none" aria-hidden="true">{symbol}</span>
                <span>{label}</span>
              </button>
            )
          })}
            </div>
            <p className="mt-4 mb-0 min-h-5 text-[.78rem] text-muted" role="status">{selectionHint ?? '節奏內容將從下一次產生節奏開始套用。'}</p>
          </section>
          <section className="border-b border-border py-[22px] last:border-b-0" aria-labelledby="playback-settings-title">
            <h3 className="mb-4 mt-0 text-base" id="playback-settings-title">播放</h3>
            <div className="grid grid-cols-2 gap-[14px]">
              <div>
                <label className="mb-[7px] block text-[.78rem] font-bold text-[#655f58]" htmlFor="advanced-bpm">播放速度 <span className="font-normal">BPM</span></label>
                <input className={`h-11 w-full rounded-[10px] border bg-[#fffdf9] px-3 text-ink ${!bpmValid ? 'border-[#a12e22]' : 'border-[#cfc6b9]'}`} id="advanced-bpm" type="number" min="20" max="400" value={playback.bpm} aria-invalid={!bpmValid} onChange={(event) => onPlaybackChange('bpm', Number(event.target.value))} />
                {!bpmValid && <small className="text-[.78rem] text-[#a12e22]">請輸入 20–400 的整數</small>}
              </div>
            </div>
            <div className="grid w-full gap-[10px]" aria-label="音量設定">
              <VolumeSlider label="小鼓" value={playback.snareVolume} onChange={(value) => onPlaybackChange('snareVolume', value)} />
              <VolumeSlider label="Click" value={playback.clickVolume} onChange={(value) => onPlaybackChange('clickVolume', value)} />
            </div>
          </section>
          <section className="flex flex-wrap items-center gap-3 py-[22px] [&>h3]:basis-full [&>h3]:m-0" aria-labelledby="other-settings-title">
            <h3 className="text-base" id="other-settings-title">其他</h3>
            <div>{installButton}</div>
            <button className="border-0 bg-transparent text-[#33353a] underline underline-offset-4" onClick={onReset}>重設所有設定</button>
            <button className="border-0 bg-transparent text-[#33353a] underline underline-offset-4" onClick={onHome}>回到 Music Tool 首頁</button>
            <Credits />
          </section>
        </div>
      </section>
    </div>
  )
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const percent = Math.round(value * 100)
  return <label className="grid grid-cols-[52px_1fr_48px] items-center gap-3 text-[.82rem]"><span>{label}</span><input className="accent-accent" type="range" min="0" max="100" value={percent} aria-label={`${label}音量`} onChange={(event) => onChange(Number(event.target.value) / 100)} /><output className="text-right text-muted">{percent}%</output></label>
}

function Credits() {
  return (
    <footer className="mt-6 border-t border-border pt-[22px] text-[.8rem] text-muted">
      <details><summary>關於與素材來源</summary><p>小鼓音效：<a href="https://freesound.org/people/sandyrb/sounds/38937/" target="_blank" rel="noreferrer">SBUC SNARE 005.wav</a>，作者 sandyrb，依 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> 使用；本版本使用公開預覽並經裁切、音量限制與淡出處理。</p></details>
    </footer>
  )
}
