import { useEffect, useRef, useState } from 'react'
import { audioPracticeDb, cachePitchTrack } from '../audioPractice/database'
import { pitchCacheId } from '../audioPractice/pitch/cacheIdentity'
import { pitchModeIds, pitchModes, type PitchMode } from '../audioPractice/pitch/profiles'
import type { PitchTrack } from '../audioPractice/pitch/types'
import { analyzeAudio } from '../audioPractice/pitch/workerClient'
import { PitchPlot } from './PitchPlot'
import type { PitchInterval } from './pitchPlotDrawing'

type Props = {
  songId: string
  duration: number
  position: number
  playing: boolean
  interval?: PitchInterval
  getAudio: () => AudioBuffer | null
  onSeek: (time: number) => void
}

type AnalysisState =
  | { type: 'working'; progress: number }
  | { type: 'ready'; track: PitchTrack; cacheError?: boolean }
  | { type: 'cancelled' | 'error' }

const controlClass = 'min-h-11 rounded-[9px] border border-border bg-[#fffdf9] px-3 text-xs text-ink'

export function PitchAnalysis({ mode, onModeChange, ...props }: Props & {
  mode: PitchMode
  onModeChange: (mode: PitchMode) => void
}) {
  return (
    <section className="mt-7 border-t border-border pt-5" aria-labelledby="pitch-analysis-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="pitch-analysis-title" className="m-0 text-base">音高曲線</h3>
        <label className="flex items-center gap-2 text-xs font-bold text-[#655f58]">
          辨識模式
          <select className={controlClass} value={mode} onChange={(event) => {
            const selected = pitchModeIds.find((id) => id === event.target.value)
            if (selected) onModeChange(selected)
          }}>
            {pitchModeIds.map((id) => <option key={id} value={id}>{pitchModes[id].label}</option>)}
          </select>
        </label>
      </div>
      <PitchAnalysisRun key={mode} {...props} mode={mode} />
    </section>
  )
}

function PitchAnalysisRun({ songId, getAudio, mode, ...plot }: Props & { mode: PitchMode }) {
  const [state, setState] = useState<AnalysisState>({ type: 'working', progress: 0 })
  const [attempt, setAttempt] = useState(0)
  const active = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    const id = pitchCacheId(songId, mode)

    async function run() {
      const cached = await audioPracticeDb.pitchTracks.get(id).catch(() => undefined)
      if (signal.aborted) return
      if (cached) {
        setState({ type: 'ready', track: cached.track })
        return
      }
      const audio = getAudio()
      if (!audio) throw new Error('Missing decoded audio')
      const track = await analyzeAudio(audio, mode, signal, (progress) => setState({ type: 'working', progress }))
      if (signal.aborted) return
      setState({ type: 'ready', track })
      try {
        await cachePitchTrack({ id, songId, track }, signal)
      } catch {
        if (!signal.aborted) setState({ type: 'ready', track, cacheError: true })
      }
    }

    void run().catch(() => {
      if (!signal.aborted) setState({ type: 'error' })
    })
    return () => controller.abort()
  }, [attempt, getAudio, mode, songId])

  if (state.type === 'ready') {
    return <>
      {state.cacheError && <p className="mt-2 mb-0 text-xs text-[#a12e22]" role="status">本機快取寫入失敗，下次開啟時會重新分析。</p>}
      <PitchPlot {...plot} track={state.track} />
    </>
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-[#fffdf9] p-3 text-sm">
      {state.type === 'working' ? <>
        <span className="tabular-nums" id="pitch-progress-label">分析音高 {Math.floor(state.progress * 100)}%</span>
        <progress className="min-w-16 flex-1 accent-accent" aria-labelledby="pitch-progress-label" max={1} value={state.progress} />
        <button className={controlClass} onClick={() => {
          active.current?.abort()
          setState({ type: 'cancelled' })
        }}>取消分析</button>
      </> : <>
        <p className="m-0 grow" role="status">{state.type === 'error' ? '音高分析失敗。' : '已取消音高分析。'}</p>
        <button className={controlClass} onClick={() => {
          setState({ type: 'working', progress: 0 })
          setAttempt((previous) => previous + 1)
        }}>重新分析</button>
      </>}
    </div>
  )
}
