import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { formatTime } from '../audioPractice/time'
import type { PitchTrack } from '../audioPractice/pitch/types'
import {
  drawPitchPlot,
  pitchAxisWidth,
  pitchDisplayData,
  timeAxisHeight,
  type PitchInterval,
  type PitchViewport,
} from './pitchPlotDrawing'

type Point = { x: number; y: number }
type Gesture = { viewport: PitchViewport; points: Point[]; moved: boolean }

const minRange = 6
const maxRange = 84
const buttonClass = 'min-h-11 rounded-[9px] border border-border px-3 text-xs text-ink'
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

type PitchPlotProps = {
  track: PitchTrack
  duration: number
  position: number
  playing: boolean
  interval?: PitchInterval
  onSeek: (time: number) => void
}

export function PitchPlot({ track, duration, position, playing, interval, onSeek }: PitchPlotProps) {
  const display = useMemo(() => pitchDisplayData(track.hz), [track])
  const minimumSpan = Math.min(duration, 1)
  const [viewport, setViewport] = useState<PitchViewport>(() => ({
    start: clamp(position - 1, 0, Math.max(0, duration - 12)),
    span: Math.min(duration, 12),
    low: display.low,
    range: display.range,
  }))
  const [follow, setFollow] = useState(true)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<Gesture | undefined>(undefined)
  const { start, span, low, range } = viewport
  const { width, height } = size
  const intervalStart = interval?.start
  const intervalEnd = interval?.end
  const intervalEnabled = interval?.enabled
  const playheadVisible = width > pitchAxisWidth && position >= start && position <= start + span
  const playheadX = pitchAxisWidth + (width - pitchAxisWidth) * (position - start) / span

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => setSize({ width: canvas.clientWidth, height: canvas.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    const region = intervalStart === undefined || intervalEnd === undefined
      ? undefined : { start: intervalStart, end: intervalEnd, enabled: Boolean(intervalEnabled) }
    drawPitchPlot(context, width, height, viewport, display.midi, track.frameStep, region)
  }, [display, height, intervalEnabled, intervalEnd, intervalStart, track.frameStep, viewport, width])

  useEffect(() => {
    const next = clamp(position - span * 0.13, 0, duration - span)
    const visibleEnd = start + span * (playing ? 0.95 : 1)
    if (!follow || (position >= start && position <= visibleEnd) || next === start) return
    const frame = requestAnimationFrame(() => setViewport((current) => ({ ...current, start: next })))
    return () => cancelAnimationFrame(frame)
  }, [duration, follow, playing, position, span, start])

  function zoomTime(nextSpan: number) {
    const anchor = playheadVisible ? position : start + span / 2
    setViewport({ ...viewport, span: nextSpan, start: clamp(anchor - (anchor - start) * nextSpan / span, 0, duration - nextSpan) })
  }

  function pointerPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  function startGesture(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || pointsRef.current.size >= 2) return
    const point = pointerPoint(event)
    if (point.x < pitchAxisWidth) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointsRef.current.set(event.pointerId, point)
    const points = [...pointsRef.current.values()]
    gestureRef.current = { viewport, points, moved: points.length > 1 }
  }

  function moveGesture(event: PointerEvent<HTMLCanvasElement>) {
    const points = pointsRef.current
    const gesture = gestureRef.current
    if (!gesture || !points.has(event.pointerId)) return
    points.set(event.pointerId, pointerPoint(event))
    const current = [...points.values()]
    const previousCenter = centerOf(gesture.points)
    const nextCenter = centerOf(current)
    const dx = nextCenter.x - previousCenter.x
    const dy = nextCenter.y - previousCenter.y
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return
    if (follow) setFollow(false)
    gesture.moved = true

    const base = gesture.viewport
    const scale = distance(gesture.points) / distance(current)
    const nextSpan = clamp(base.span * scale, minimumSpan, duration)
    const nextRange = clamp(base.range * scale, minRange, maxRange)
    const timeWidth = Math.max(1, width - pitchAxisWidth)
    const pitchHeight = Math.max(1, height - timeAxisHeight)
    const anchorTime = base.start + (previousCenter.x - pitchAxisWidth) / timeWidth * base.span
    const anchorPitch = base.low + (1 - previousCenter.y / pitchHeight) * base.range
    setViewport({
      start: clamp(anchorTime - (nextCenter.x - pitchAxisWidth) / timeWidth * nextSpan, 0, duration - nextSpan),
      span: nextSpan,
      low: clamp(anchorPitch - (1 - nextCenter.y / pitchHeight) * nextRange, 12, 110 - nextRange),
      range: nextRange,
    })
  }

  function endGesture(event: PointerEvent<HTMLCanvasElement>, seek: boolean) {
    const gesture = gestureRef.current
    if (!pointsRef.current.delete(event.pointerId) || !gesture) return
    if (seek && !gesture.moved) {
      const point = pointerPoint(event)
      onSeek(clamp(start + (point.x - pitchAxisWidth) / Math.max(1, width - pitchAxisWidth) * span, 0, duration))
    }
    const points = [...pointsRef.current.values()]
    gestureRef.current = points.length ? { viewport, points, moved: true } : undefined
  }

  return (
    <div className="mt-3 grid gap-3">
      {!display.hasPitch && <p className="m-0 text-xs text-muted">這段音源沒有偵測到可靠的音高。</p>}
      <div className="relative overflow-hidden rounded-xl border border-border bg-[#fffdf9]">
        <canvas
          ref={canvasRef}
          className="block h-[280px] w-full touch-none cursor-crosshair focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent max-[760px]:h-[232px]"
          tabIndex={0}
          aria-label="音高曲線。點按定位、拖曳移動、雙指縮放，或用左右方向鍵跳轉一秒。"
          onPointerDown={startGesture}
          onPointerMove={moveGesture}
          onPointerUp={(event) => endGesture(event, true)}
          onPointerCancel={(event) => endGesture(event, false)}
          onLostPointerCapture={(event) => endGesture(event, false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              onSeek(clamp(position + (event.key === 'ArrowLeft' ? -1 : 1), 0, duration))
            }
          }}
        />
        {playheadVisible && <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 w-[2px] bg-ink"
          style={{ left: Math.min(width - 2, playheadX), bottom: timeAxisHeight }}
        />}
      </div>
      <label className="flex min-h-9 items-center gap-3 text-xs font-bold text-[#655f58]">
        時間捲動
        <input
          className="min-h-9 min-w-0 flex-1 accent-accent"
          aria-valuetext={formatTime(start)}
          type="range"
          min={0}
          max={Math.max(0, duration - span)}
          step="any"
          disabled={duration <= span}
          value={start}
          onChange={(event) => {
            setFollow(false)
            setViewport({ ...viewport, start: Number(event.target.value) })
          }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-h-11 min-w-[140px] flex-1 items-center gap-2 text-xs font-bold text-[#655f58]">
          時間縮放
          <input
            className="min-w-0 flex-1 accent-accent"
            type="range"
            min={0}
            max={Math.log2(duration / minimumSpan)}
            step="any"
            disabled={duration <= minimumSpan}
            value={Math.log2(duration / span)}
            onChange={(event) => zoomTime(duration / 2 ** Number(event.target.value))}
          />
        </label>
        <label className="flex min-h-11 min-w-[140px] flex-1 items-center gap-2 text-xs font-bold text-[#655f58]">
          音高縮放
          <input
            className="min-w-0 flex-1 accent-accent"
            type="range"
            min={minRange}
            max={maxRange}
            step="any"
            value={minRange + maxRange - range}
            onChange={(event) => {
              const nextRange = minRange + maxRange - Number(event.target.value)
              setViewport({ ...viewport, range: nextRange, low: clamp(low + (range - nextRange) / 2, 12, 110 - nextRange) })
            }}
          />
        </label>
        <button
          className={`${buttonClass} aria-pressed:border-accent aria-pressed:text-accent-dark`}
          type="button"
          aria-pressed={follow}
          onClick={() => {
            if (!follow) setViewport({ ...viewport, start: clamp(position - span * 0.13, 0, duration - span) })
            setFollow(!follow)
          }}
        >跟隨播放</button>
      </div>
    </div>
  )
}

function centerOf(points: Point[]): Point {
  if (points.length < 2) return points[0]
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
}

function distance(points: Point[]): number {
  return points.length < 2 ? 1 : Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y))
}
