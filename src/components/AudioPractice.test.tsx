import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { audioPracticeDb, type PracticeSection, type PracticeSong } from '../audioPractice/database'

const mockAudio = vi.hoisted(() => ({
  events: new Map<string, Array<(...args: never[]) => void>>(),
  regions: [] as Array<{ id: string; start: number; end: number; setOptions: (options: { start?: number; end?: number }) => void; remove: () => void }>,
}))

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: (name: string, callback: (...args: never[]) => void) => {
        const callbacks = mockAudio.events.get(name) ?? []
        callbacks.push(callback)
        mockAudio.events.set(name, callbacks)
        return () => undefined
      },
      load: async () => {
        mockAudio.events.get('ready')?.forEach((callback) => callback())
      },
      setTime: () => undefined,
      getDuration: () => 60,
      getCurrentTime: () => 0,
      play: async () => undefined,
      pause: () => undefined,
      destroy: () => undefined,
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
