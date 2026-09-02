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

function measuresPerSystemForViewport(): 1 | 2 | 4 {
  if (window.matchMedia?.('(min-width: 1200px)').matches) return 4
  if (window.matchMedia?.('(min-width: 600px)').matches) return 2
  return 1
}

export function ScoreView({ exercise, activeEventIndex, reduceMotion }: ScoreViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const cursorIndexRef = useRef(-1)
  const [error, setError] = useState<string>()
  const [measuresPerSystem, setMeasuresPerSystem] = useState<1 | 2 | 4>(measuresPerSystemForViewport)

  useEffect(() => {
    const wideMedia = window.matchMedia?.('(min-width: 1200px)')
    const mediumMedia = window.matchMedia?.('(min-width: 600px)')
    if (!wideMedia || !mediumMedia) return
    const updateLayout = () => setMeasuresPerSystem(measuresPerSystemForViewport())
    updateLayout()
    wideMedia.addEventListener('change', updateLayout)
    mediumMedia.addEventListener('change', updateLayout)
    return () => {
      wideMedia.removeEventListener('change', updateLayout)
      mediumMedia.removeEventListener('change', updateLayout)
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
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
