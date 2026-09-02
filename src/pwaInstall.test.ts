import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type BeforeInstallPromptEvent,
  shouldShowInstallBanner,
  usePwaInstall,
} from './pwaInstall'

const DISMISSAL_STORAGE_KEY = 'music-tool:pwa-install-dismissed-at'

function createInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent
  const prompt = vi.fn().mockResolvedValue(undefined)
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome, platform: 'web' }) },
  })
  return { event, prompt }
}

describe('usePwaInstall', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  it('captures an install prompt and offers both install entry points', () => {
    const { result } = renderHook(() => usePwaInstall())
    const { event } = createInstallPrompt()

    act(() => window.dispatchEvent(event))

    expect(event.defaultPrevented).toBe(true)
    expect(result.current.canInstall).toBe(true)
    expect(result.current.showBanner).toBe(true)
  })

  it('suppresses the active banner for seven days after choosing later', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const { result, unmount } = renderHook(() => usePwaInstall())
    act(() => window.dispatchEvent(createInstallPrompt().event))
    act(() => result.current.dismissBanner())

    expect(result.current.canInstall).toBe(true)
    expect(result.current.showBanner).toBe(false)
    expect(window.localStorage.getItem(DISMISSAL_STORAGE_KEY)).toBe(String(now.getTime()))
    unmount()

    vi.setSystemTime(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))
    const nextVisit = renderHook(() => usePwaInstall())
    act(() => window.dispatchEvent(createInstallPrompt().event))
    expect(nextVisit.result.current.showBanner).toBe(true)
    vi.useRealTimers()
  })

  it('records a native prompt cancellation and consumes the one-time event', async () => {
    const { result } = renderHook(() => usePwaInstall())
    const { event, prompt } = createInstallPrompt('dismissed')
    act(() => window.dispatchEvent(event))

    await act(() => result.current.requestInstall())

    expect(prompt).toHaveBeenCalledOnce()
    expect(result.current.canInstall).toBe(false)
    expect(window.localStorage.getItem(DISMISSAL_STORAGE_KEY)).not.toBeNull()
  })

  it('hides installation controls after the app is installed', () => {
    const { result } = renderHook(() => usePwaInstall())
    act(() => window.dispatchEvent(createInstallPrompt().event))
    act(() => window.dispatchEvent(new Event('appinstalled')))

    expect(result.current.canInstall).toBe(false)
    expect(result.current.showBanner).toBe(false)
  })
})

describe('shouldShowInstallBanner', () => {
  it('gives the service worker update notice priority', () => {
    expect(shouldShowInstallBanner(true, true)).toBe(false)
    expect(shouldShowInstallBanner(true, false)).toBe(true)
  })
})
