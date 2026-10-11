import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { audioPracticeDb, type PracticeSection, type PracticeSong } from '../audioPractice/database'

const mockAudio = vi.hoisted(() => ({
  setPlaybackRate: vi.fn(),
  setTime: vi.fn(),
  pause: vi.fn(),
  destroy: vi.fn(),
  events: new Map<string, Array<(...args: number[]) => void>>(),
  regions: [] as Array<{ id: string; start: number; end: number; setOptions: (options: { start?: number; end?: number }) => void; remove: () => void }>,
}))

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: (name: string, callback: (...args: number[]) => void) => {
        const callbacks = mockAudio.events.get(name) ?? []
        callbacks.push(callback)
        mockAudio.events.set(name, callbacks)
        return () => undefined
      },
      load: async () => {
        mockAudio.events.get('ready')?.forEach((callback) => callback())
      },
      setPlaybackRate: mockAudio.setPlaybackRate,
      setTime: mockAudio.setTime,
      getDuration: () => 60,
      getCurrentTime: () => 0,
      play: async () => { mockAudio.events.get('play')?.forEach((callback) => callback()) },
      pause: mockAudio.pause,
      destroy: () => {
        mockAudio.destroy()
        mockAudio.events.clear()
      },
    }),
  },
}))

vi.mock('wavesurfer.js/dist/plugins/regions.js', () => ({
  default: {
    create: () => ({
      on: () => () => undefined,
      addRegion: (options: { id?: string; start: number; end?: number }) => {
        const region = {
          id: options.id ?? `region-${mockAudio.regions.length + 1}`,
          start: options.start,
          end: options.end ?? options.start + 1,
          setOptions: (next: { start?: number; end?: number }) => {
            if (next.start !== undefined) region.start = next.start
            if (next.end !== undefined) region.end = next.end
          },
          remove: () => { mockAudio.regions = mockAudio.regions.filter((item) => item !== region) },
        }
        mockAudio.regions.push(region)
        return region
      },
      getRegions: () => mockAudio.regions,
      enableDragSelection: () => () => undefined,
    }),
  },
}))

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  mockAudio.events.clear()
  mockAudio.regions = []
  await audioPracticeDb.delete()
  await audioPracticeDb.open()
})

describe('audio practice sections', () => {
  it('selects a saved section and automatically persists edited boundaries', async () => {
    const song: PracticeSong = {
      id: 'song-1',
      title: 'Practice track',
      fileName: 'practice.mp3',
      audio: new Blob(['audio']),
      duration: 60,
      createdAt: 1,
    }
    const section: PracticeSection = {
      id: 'section-1',
      songId: song.id,
      name: 'Verse',
      start: 3,
      end: 8,
      updatedAt: 1,
    }
    await audioPracticeDb.songs.add(song)
    await audioPracticeDb.sections.add(section)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:practice-audio')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const { AudioPractice } = await import('./AudioPractice')

    render(<AudioPractice onHome={() => undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: /Verse/ }))
    expect((screen.getByRole('textbox', { name: 'A 起點' }) as HTMLInputElement).value).toBe('00:03.00')
    fireEvent.change(screen.getByRole('textbox', { name: 'B 終點' }), { target: { value: '00:09.00' } })

    await waitFor(async () => {
      expect((await audioPracticeDb.sections.get(section.id))?.end).toBe(9)
    })
  })
})


describe('audio practice speed', () => {
  async function seedSongs() {
    const song: PracticeSong = {
      id: 'slow-song',
      title: 'Slow track',
      fileName: 'slow.mp3',
      audio: new Blob(['audio']),
      duration: 60,
      createdAt: 2,
      playbackRate: 0.75,
    }
    await audioPracticeDb.songs.bulkAdd([
      song,
      { ...song, id: 'normal-song', title: 'Normal track', createdAt: 1, playbackRate: undefined },
    ])
    await audioPracticeDb.sections.add({
      id: 'verse', songId: song.id, name: 'Verse', start: 3, end: 8, updatedAt: 1,
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:practice-audio')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  }

  it('changes speed during playback without pausing or seeking and keeps original loop boundaries', async () => {
    await seedSongs()
    const { AudioPractice } = await import('./AudioPractice')
    render(<AudioPractice onHome={() => undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: /Verse/ }))
    fireEvent.click(screen.getByRole('button', { name: '播放' }))
    mockAudio.setTime.mockClear()
    mockAudio.pause.mockClear()
    mockAudio.destroy.mockClear()

    const slider = screen.getByRole('slider', { name: '播放速度' })
    expect(slider.getAttribute('min')).toBe('0.5')
    expect(slider.getAttribute('max')).toBe('1')
    expect(slider.getAttribute('step')).toBe('0.05')
    fireEvent.change(slider, { target: { value: '0.5' } })
    act(() => {
      mockAudio.events.get('ready')?.forEach((callback) => callback())
    })
    expect(mockAudio.setPlaybackRate).toHaveBeenLastCalledWith(0.5, true)
    expect(mockAudio.pause).not.toHaveBeenCalled()
    expect(mockAudio.destroy).not.toHaveBeenCalled()
    expect(mockAudio.setTime).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '暫停' })).toBeDefined()

    act(() => {
      mockAudio.events.get('audioprocess')?.forEach((callback) => callback(8))
    })
    expect(mockAudio.setTime).toHaveBeenLastCalledWith(3)
    expect((screen.getByRole('textbox', { name: 'B 終點' }) as HTMLInputElement).value).toBe('00:08.00')
    fireEvent.click(screen.getByRole('button', { name: /Verse/ }))
    expect((slider as HTMLInputElement).value).toBe('0.5')
    await waitFor(async () => {
      expect((await audioPracticeDb.songs.get('slow-song'))?.playbackRate).toBe(0.5)
    })
  })

  it('restores each song speed after switching and reopening, and persists reset to original speed', async () => {
    await seedSongs()
    const { AudioPractice } = await import('./AudioPractice')
    const view = render(<AudioPractice onHome={() => undefined} />)
    const slider = await screen.findByRole('slider', { name: '播放速度' })
    expect((slider as HTMLInputElement).value).toBe('0.75')
    expect(mockAudio.setPlaybackRate).toHaveBeenLastCalledWith(0.75, true)
    fireEvent.change(slider, { target: { value: '0.65' } })
    await waitFor(async () => {
      expect((await audioPracticeDb.songs.get('slow-song'))?.playbackRate).toBe(0.65)
    })

    fireEvent.click(screen.getByRole('button', { name: /^Normal track/ }))
    expect((slider as HTMLInputElement).value).toBe('1')
    expect(mockAudio.setPlaybackRate).toHaveBeenLastCalledWith(1, true)
    fireEvent.click(screen.getByRole('button', { name: /^Slow track/ }))
    expect((slider as HTMLInputElement).value).toBe('0.65')
    expect(mockAudio.setPlaybackRate).toHaveBeenLastCalledWith(0.65, true)
    await waitFor(async () => {
      expect((await audioPracticeDb.preferences.get('last-opened'))?.songId).toBe('slow-song')
    })
    view.unmount()

    render(<AudioPractice onHome={() => undefined} />)
    const restored = await screen.findByRole('slider', { name: '播放速度' })
    expect((restored as HTMLInputElement).value).toBe('0.65')
    expect(mockAudio.setPlaybackRate).toHaveBeenLastCalledWith(0.65, true)
    fireEvent.click(screen.getByRole('button', { name: '恢復原速' }))
    expect((restored as HTMLInputElement).value).toBe('1')
    expect(mockAudio.setPlaybackRate).toHaveBeenLastCalledWith(1, true)
    await waitFor(async () => {
      expect((await audioPracticeDb.songs.get('slow-song'))?.playbackRate).toBe(1)
      expect((await audioPracticeDb.songs.get('normal-song'))?.playbackRate).toBeUndefined()
    })
  })
})
