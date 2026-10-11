import Dexie, { type Table } from 'dexie'

export type PracticeSong = {
  id: string
  title: string
  fileName: string
  audio: Blob
  duration: number
  playbackRate?: number
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

class AudioPracticeDatabase extends Dexie {
  songs!: Table<PracticeSong, string>
  sections!: Table<PracticeSection, string>
  preferences!: Table<PracticePreference, string>

  constructor() {
    super('music-tool:audio-practice:v1')
    this.version(1).stores({
      songs: 'id, title, createdAt',
      sections: 'id, songId, updatedAt',
      preferences: 'key',
    })
  }
}

export const audioPracticeDb = new AudioPracticeDatabase()

export async function addSong(song: PracticeSong): Promise<void> {
  await audioPracticeDb.songs.add(song)
}

export async function deleteSong(songId: string): Promise<void> {
  await audioPracticeDb.transaction('rw', audioPracticeDb.songs, audioPracticeDb.sections, async () => {
    await audioPracticeDb.songs.delete(songId)
    await audioPracticeDb.sections.where('songId').equals(songId).delete()
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
