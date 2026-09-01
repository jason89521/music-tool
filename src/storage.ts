import type { GenerationSettings, PlaybackSettings, RhythmExercise } from './domain/rhythm'

export type PersistedState = {
  generation: GenerationSettings
  playback: PlaybackSettings
  exercise: RhythmExercise
}

const STORAGE_KEY = 'music-tool:rhythm-practice:v1'

export function loadState(): PersistedState | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as PersistedState) : undefined
  } catch {
    return undefined
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
