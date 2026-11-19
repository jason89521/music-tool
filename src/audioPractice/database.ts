import Dexie, { type Table } from 'dexie'
import type { PitchMode } from './pitch/profiles'
import type { PitchTrack } from './pitch/types'

export type PracticeSong = {
  id: string
  title: string
  fileName: string
  audio: Blob
  duration: number
  playbackRate?: number
  pitchMode?: PitchMode
  createdAt: number
}

export type PracticeSection = {
  id: string
  songId: string
  name: string
  start: number
  end: number
  updatedAt: number
}

export type PracticePreference = {
  key: 'last-opened'
  songId?: string
  sectionId?: string
  position?: number
}

export type CachedPitchTrack = { id: string; songId: string; track: PitchTrack }

class AudioPracticeDatabase extends Dexie {
  songs!: Table<PracticeSong, string>
  sections!: Table<PracticeSection, string>
  preferences!: Table<PracticePreference, string>
  pitchTracks!: Table<CachedPitchTrack, string>

  constructor() {
    super('music-tool:audio-practice:v1')
    this.version(1).stores({
      songs: 'id, title, createdAt',
      sections: 'id, songId, updatedAt',
      preferences: 'key',
    })
    this.version(2).stores({ pitchTracks: 'id, songId' })
  }
}

export const audioPracticeDb = new AudioPracticeDatabase()

export async function addSong(song: PracticeSong): Promise<void> {
  await audioPracticeDb.songs.add(song)
}

export async function deleteSong(songId: string): Promise<void> {
  const { songs, sections, pitchTracks } = audioPracticeDb
  await audioPracticeDb.transaction('rw', songs, sections, pitchTracks, async () => {
    await songs.delete(songId)
    await sections.where('songId').equals(songId).delete()
    await pitchTracks.where('songId').equals(songId).delete()
  })
}

export async function saveSection(section: PracticeSection): Promise<void> {
  await audioPracticeDb.sections.put(section)
}

export async function deleteSection(sectionId: string): Promise<void> {
  await audioPracticeDb.sections.delete(sectionId)
}

export async function savePreference(preference: PracticePreference): Promise<void> {
  await audioPracticeDb.preferences.put(preference)
}

export async function cachePitchTrack(entry: CachedPitchTrack, signal: AbortSignal): Promise<void> {
  const { songs, pitchTracks } = audioPracticeDb
  await audioPracticeDb.transaction('rw', songs, pitchTracks, async () => {
    const song = await songs.where('id').equals(entry.songId).count()
    if (song && !signal.aborted) await pitchTracks.put(entry)
  })
}
