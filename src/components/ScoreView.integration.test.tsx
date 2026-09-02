import { render, waitFor } from '@testing-library/react'
import { beforeEach, vi, describe, expect, it } from 'vitest'
import { generateRhythm } from '../domain/generateRhythm'
import { ScoreView } from './ScoreView'

const scoreMockState = vi.hoisted(() => ({
  drawPartNames: true,
  engravingRules: undefined as Record<string, boolean | number> | undefined,
  loadedScores: [] as string[],
  renderCount: 0,
}))

let resize: (width: number) => void

beforeEach(() => {
  scoreMockState.drawPartNames = true
  scoreMockState.engravingRules = undefined
  scoreMockState.loadedScores = []
  scoreMockState.renderCount = 0
  resize = () => undefined
  vi.stubGlobal(
    'ResizeObserver',
    class {
      public constructor(callback: ResizeObserverCallback) {
        resize = (width) =>
          callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }

      public disconnect(): void {}

      public observe(): void {}
    },
  )
})

vi.mock('opensheetmusicdisplay', () => ({
  OpenSheetMusicDisplay: class {
    public EngravingRules = {
      PercussionOneLineCutoff: 0,
      PercussionUseXMLDisplayStep: false,
    }
    public cursor = {
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn(),
      next: vi.fn(),
    }
    private readonly host: HTMLElement

    public constructor(host: HTMLElement, options: { drawPartNames?: boolean }) {
      this.host = host
      scoreMockState.drawPartNames = options.drawPartNames ?? true
      scoreMockState.engravingRules = this.EngravingRules
    }

    public async load(score: string): Promise<void> {
      scoreMockState.loadedScores.push(score)
    }

    public render(): void {
      scoreMockState.renderCount += 1
      const score = document.createElement('svg')
      score.dataset.render = String(scoreMockState.renderCount)
      this.host.append(score)
    }
  },
}))

describe('ScoreView', () => {
  it('replaces the previous score when the exercise changes', async () => {
    const first = generateRhythm({ selectedMaterials: ['quarter'], measureCount: 1 }, () => 0.1)
    const second = generateRhythm({ selectedMaterials: ['eighth'], measureCount: 2 }, () => 0.8)
    const view = render(<ScoreView exercise={first} activeEventIndex={-1} reduceMotion />)
    await waitFor(() => expect(view.container.querySelectorAll('svg')).toHaveLength(1))
    expect(scoreMockState.drawPartNames).toBe(false)

    view.rerender(<ScoreView exercise={second} activeEventIndex={-1} reduceMotion />)

    await waitFor(() => expect(view.container.querySelector('svg[data-render="2"]')).not.toBeNull())
    expect(view.container.querySelectorAll('svg')).toHaveLength(1)
  })

  it('uses the score container width to choose the system layout', async () => {
    const exercise = generateRhythm({ selectedMaterials: ['quarter'], measureCount: 4 }, () => 0.1)
    render(<ScoreView exercise={exercise} activeEventIndex={-1} reduceMotion />)
    await waitFor(() => expect(scoreMockState.loadedScores).toHaveLength(1))

    resize(600)

    await waitFor(() => expect(scoreMockState.loadedScores).toHaveLength(2))
    expect(scoreMockState.loadedScores.at(-1)?.match(/<print new-system="yes"\/>/g)).toHaveLength(1)

    resize(1200)

    await waitFor(() => expect(scoreMockState.loadedScores).toHaveLength(3))
    expect(scoreMockState.loadedScores.at(-1)).not.toContain('<print new-system="yes"/>')
  })

  it('removes redundant score symbols and page margins', async () => {
    const exercise = generateRhythm({ selectedMaterials: ['quarter'], measureCount: 1 }, () => 0.1)
    render(<ScoreView exercise={exercise} activeEventIndex={-1} reduceMotion />)
    await waitFor(() => expect(scoreMockState.engravingRules).toBeDefined())

    expect(scoreMockState.engravingRules).toMatchObject({
      PageBottomMargin: 0,
      PageLeftMargin: 0,
      PageRightMargin: 0,
      PageTopMargin: 0,
      PageTopMarginNarrow: 0,
      RenderClefsAtBeginningOfStaffline: false,
      RenderMeasureNumbers: false,
      RenderTimeSignatures: false,
    })
  })
})
