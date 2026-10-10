import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { audioPracticeDb, addSong, deleteSong, saveSection, type PracticeSong } from './database'

const song = (id: string): PracticeSong => ({
  id,
  title: 'Practice track',
  fileName: 'practice.mp3',
  audio: new Blob(['audio']),
  duration: 90,
  createdAt: Date.now(),
})

afterEach(async () => {
  await audioPracticeDb.delete()
  await audioPracticeDb.open()
})

describe('audio practice persistence', () => {
  it('keeps same-name imports as separate songs and removes child sections with a song', async () => {
    await addSong(song('first'))
    await addSong(song('second'))
    await saveSection({ id: 'section', songId: 'first', name: 'Verse', start: 2, end: 8, updatedAt: Date.now() })

    expect(await audioPracticeDb.songs.count()).toBe(2)
    expect(await audioPracticeDb.songs.get('first')).toBeDefined()
    await deleteSong('first')
    expect(await audioPracticeDb.sections.count()).toBe(0)
    expect(await audioPracticeDb.songs.count()).toBe(1)
  })
})
