// @vitest-environment node

import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { audioPracticeDb, addSong, cachePitchTrack, deleteSong, saveSection, type PracticeSong } from './database'
import { pitchCacheId } from './pitch/cacheIdentity'

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

describe('offline pitch cache', () => {
  it('keys by song and profile, round-trips typed arrays and cleans up after deletion', async () => {
    await addSong(song('first'))
    await addSong(song('second'))
    const track = {
      frameStep: 0.01,
      rawHz: Float32Array.of(30.87, 0),
      hz: Float32Array.of(30.87, 0),
      confidence: Float32Array.of(0.98, 0),
    }
    const controller = new AbortController()
    const general = { songId: 'first', id: pitchCacheId('first', 'general'), track }
    const bass = { songId: 'first', id: pitchCacheId('first', 'bass'), track }
    const other = { songId: 'second', id: pitchCacheId('second', 'bass'), track }
    for (const entry of [general, bass, other]) await cachePitchTrack(entry, controller.signal)

    const restored = await audioPracticeDb.pitchTracks.get(bass.id)
    expect(restored?.songId).toBe(bass.songId)
    expect(restored?.track.frameStep).toBe(track.frameStep)
    for (const key of ['rawHz', 'hz', 'confidence'] as const) {
      expect(Object.prototype.toString.call(restored?.track[key])).toBe('[object Float32Array]')
      expect(Array.from(restored?.track[key] ?? [])).toEqual(Array.from(track[key]))
    }
    expect(await audioPracticeDb.pitchTracks.count()).toBe(3)
    await deleteSong('first')
    await cachePitchTrack(general, controller.signal)
    expect(await audioPracticeDb.pitchTracks.toCollection().primaryKeys()).toEqual([other.id])

    controller.abort()
    await cachePitchTrack({ ...other, id: pitchCacheId('second', 'general') }, controller.signal)
    expect(await audioPracticeDb.pitchTracks.count()).toBe(1)
  })
})

it('upgrades an existing version-one library without altering tracks, saved sections or preferences', async () => {
  await audioPracticeDb.delete()
  const legacy = new Dexie(audioPracticeDb.name)
  legacy.version(1).stores({
    songs: 'id, title, createdAt',
    sections: 'id, songId, updatedAt',
    preferences: 'key',
  })
  await legacy.table('songs').add({ ...song('legacy'), playbackRate: 0.75 })
  await legacy.table('sections').add({ id: 'verse', songId: 'legacy', name: '主歌', start: 2, end: 6, updatedAt: 1 })
  await legacy.table('preferences').add({ key: 'last-opened', songId: 'legacy', sectionId: 'verse', position: 3.25 })
  legacy.close()

  await audioPracticeDb.open()
  expect((await audioPracticeDb.songs.get('legacy'))?.playbackRate).toBe(0.75)
  expect((await audioPracticeDb.songs.get('legacy'))?.audio.size).toBe(5)
  expect(await audioPracticeDb.sections.get('verse')).toMatchObject({ start: 2, end: 6 })
  expect(await audioPracticeDb.preferences.get('last-opened')).toMatchObject({ sectionId: 'verse', position: 3.25 })
  expect(await audioPracticeDb.pitchTracks.count()).toBe(0)
})
