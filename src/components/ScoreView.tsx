import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import type { RhythmExercise } from '../domain/rhythm'
import { scoreEventIndex, toMusicXml } from '../score/toMusicXml'
import { moveCursorToEvent } from './cursorNavigation'

type ScoreViewProps = {
  exercise: RhythmExercise
  activeEventIndex: number
  reduceMotion: boolean
}

function measuresPerSystemForWidth(width: number): 1 | 2 | 4 {
  if (width >= 1200) return 4
  if (width >= 600) return 2
  return 1
}

export function ScoreView({ exercise, activeEventIndex, reduceMotion }: ScoreViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const cursorIndexRef = useRef(-1)
  const previousExerciseRef = useRef<RhythmExercise | undefined>(undefined)
  const [error, setError] = useState<string>()
  const [measuresPerSystem, setMeasuresPerSystem] = useState<1 | 2 | 4>(1)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setMeasuresPerSystem(measuresPerSystemForWidth(entry.contentRect.width))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const exerciseChanged = previousExerciseRef.current !== exercise
    const maximumScrollTop = host.scrollHeight - host.clientHeight
    const relativeScrollPosition = maximumScrollTop > 0 ? host.scrollTop / maximumScrollTop : 0
    previousExerciseRef.current = exercise
    host.replaceChildren()
    const osmd = new OpenSheetMusicDisplay(host, {
      autoResize: true,
      backend: 'svg',
      drawPartNames: false,
      drawTitle: false,
      followCursor: false,
      newSystemFromXML: true,
      spacingFactorSoftmax: 1,
    })
    osmd.EngravingRules.PercussionOneLineCutoff = 0
    osmd.EngravingRules.PercussionUseXMLDisplayStep = true
    osmd.EngravingRules.PageTopMargin = 0
    osmd.EngravingRules.PageTopMarginNarrow = 0
    osmd.EngravingRules.PageBottomMargin = 0
    osmd.EngravingRules.PageLeftMargin = 0
    osmd.EngravingRules.PageRightMargin = 0
    osmd.EngravingRules.RenderClefsAtBeginningOfStaffline = false
    osmd.EngravingRules.RenderMeasureNumbers = false
    osmd.EngravingRules.RenderTimeSignatures = false
    osmd.Zoom = 1
    osmdRef.current = osmd
    let cancelled = false
    void osmd
      .load(toMusicXml(exercise, { measuresPerSystem }))
      .then(() => {
        if (cancelled) return
        osmd.render()
        osmd.cursor.reset()
        osmd.cursor.hide()
        cursorIndexRef.current = -1
        const nextMaximumScrollTop = host.scrollHeight - host.clientHeight
        host.scrollTop = exerciseChanged ? 0 : relativeScrollPosition * nextMaximumScrollTop
        setError(undefined)
      })
      .catch(() => setError('樂譜暫時無法顯示，請重新產生節奏。'))
    return () => {
      cancelled = true
      osmdRef.current = null
      host.replaceChildren()
    }
  }, [exercise, measuresPerSystem])

  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !osmd.cursor) return
    const visibleEventIndex = scoreEventIndex(exercise, activeEventIndex)
    moveCursorToEvent(osmd.cursor, visibleEventIndex)
    cursorIndexRef.current = -1
    if (visibleEventIndex < 0) return
    cursorIndexRef.current = visibleEventIndex
    const cursorElement = hostRef.current?.querySelector<HTMLElement>('#cursorImg-0')
    cursorElement?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'center',
    })
  }, [activeEventIndex, exercise, reduceMotion])

  return (
    <section className="score-card" aria-label="節奏樂譜">
      {error ? <p role="alert">{error}</p> : <div className="score" ref={hostRef} />}
    </section>
  )
}
