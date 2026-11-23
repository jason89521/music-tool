import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { scheduleClick } from '../audio/scheduleClick'
import { Metronome } from './Metronome'

vi.mock('../audio/scheduleClick', () => ({ scheduleClick: vi.fn() }))

class TestAudioContext {
  private startedAt = Date.now()

  get currentTime() {
    return (Date.now() - this.startedAt) / 1000
  }

  resume = vi.fn().mockResolvedValue(undefined)
  close = vi.fn().mockResolvedValue(undefined)
}

function advanceClock(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', TestAudioContext)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const touchPointer = { button: 0, pointerType: 'touch', isPrimary: true }

it('changes tempo by one on tap and repeats ten-point steps on hold until release or cancellation', () => {
  render(<Metronome onHome={vi.fn()} />)
  const tempo = screen.getByLabelText('速度')
  const increase = screen.getByRole('button', { name: '加快速度' })
  const decrease = screen.getByRole('button', { name: '放慢速度' })
  fireEvent.pointerDown(increase, touchPointer)
  advanceClock(100)
  fireEvent.pointerUp(increase, touchPointer)
  fireEvent.click(increase, { detail: 1 })
  advanceClock(500)
  expect(tempo.textContent).toBe('121')

  fireEvent.pointerDown(decrease, touchPointer)
  advanceClock(449)
  expect(tempo.textContent).toBe('121')
  advanceClock(1)
  expect(tempo.textContent).toBe('111')
  advanceClock(300)
  expect(tempo.textContent).toBe('91')
  fireEvent.pointerUp(decrease, touchPointer)
  fireEvent.click(decrease, { detail: 1 })
  advanceClock(500)
  expect(tempo.textContent).toBe('91')

  fireEvent.pointerDown(increase, touchPointer)
  advanceClock(600)
  expect(tempo.textContent).toBe('111')
  fireEvent.pointerCancel(increase, touchPointer)
  advanceClock(500)
  expect(tempo.textContent).toBe('111')
})

it('stops the hold timer when the tempo reaches its limit', () => {
  render(<Metronome onHome={vi.fn()} />)
  const tempo = screen.getByLabelText('速度')
  const decrease = screen.getByRole<HTMLButtonElement>('button', { name: '放慢速度' })

  fireEvent.pointerDown(decrease, touchPointer)
  advanceClock(1800)
  expect(tempo.textContent).toBe('20')
  expect(decrease.disabled).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('counts muted beats and applies sound and tempo changes while playing', async () => {
  const { unmount } = render(<Metronome onHome={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '第 2 拍，普通' }))

  await act(async () => fireEvent.click(screen.getByRole('button', { name: '開始' })))
  advanceClock(25)
  expect(screen.getByRole('button', { name: '第 1 拍，重拍' }).getAttribute('aria-current')).toBe('true')
  expect(scheduleClick).toHaveBeenLastCalledWith(expect.any(TestAudioContext), 0.02, true, 1)

  advanceClock(500)
  expect(screen.getByRole('button', { name: '第 2 拍，靜音' }).getAttribute('aria-current')).toBe('true')
  expect(scheduleClick).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('button', { name: '加快速度' }))
  fireEvent.click(screen.getByRole('button', { name: '第 3 拍，普通' }))
  fireEvent.click(screen.getByRole('button', { name: '第 3 拍，靜音' }))
  advanceClock(500)
  expect(screen.getByRole('button', { name: '第 3 拍，重拍' }).getAttribute('aria-current')).toBe('true')
  const lastClick = vi.mocked(scheduleClick).mock.lastCall
  expect(lastClick?.[1]).toBeCloseTo(0.52 + 60 / 121)
  expect(lastClick?.slice(2)).toEqual([true, 1])

  advanceClock(500)
  expect(screen.getByRole('button', { name: '第 4 拍，普通' }).getAttribute('aria-current')).toBe('true')
  advanceClock(500)
  expect(screen.getByRole('button', { name: '第 1 拍，重拍' }).getAttribute('aria-current')).toBe('true')

  const context = lastClick?.[0]
  unmount()
  expect(context?.close).toHaveBeenCalledOnce()
  advanceClock(500)
  expect(scheduleClick).toHaveBeenCalledTimes(4)
})
