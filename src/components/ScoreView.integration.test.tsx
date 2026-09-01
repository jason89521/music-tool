import { render, waitFor } from '@testing-library/react'
import { vi, describe, expect, it } from 'vitest'
import { generateRhythm } from '../domain/generateRhythm'
import { ScoreView } from './ScoreView'

const scoreMockState = vi.hoisted(() => ({ renderCount: 0, drawPartNames: true }))

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
    }

    public async load(): Promise<void> {}

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
    scoreMockState.renderCount = 0
    scoreMockState.drawPartNames = true
    const first = generateRhythm({ difficulty: 'easy', measureCount: 1 }, () => 0.1)
    const second = generateRhythm({ difficulty: 'easy', measureCount: 2 }, () => 0.8)
    const view = render(<ScoreView exercise={first} activeEventIndex={-1} reduceMotion />)
    await waitFor(() => expect(view.container.querySelectorAll('svg')).toHaveLength(1))
    expect(scoreMockState.drawPartNames).toBe(false)

    view.rerender(<ScoreView exercise={second} activeEventIndex={-1} reduceMotion />)

    await waitFor(() => expect(view.container.querySelector('svg[data-render="2"]')).not.toBeNull())
    expect(view.container.querySelectorAll('svg')).toHaveLength(1)
  })
})
