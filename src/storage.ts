import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
  type PlaybackSettings,
  type RhythmExercise,
  type RhythmMaterial,
} from './domain/rhythm'

export type PersistedState = {
  generation: GenerationSettings
  playback: PlaybackSettings
  exercise: RhythmExercise
}

const STORAGE_KEY = 'music-tool:rhythm-practice:v1'
const RHYTHM_MATERIALS: readonly RhythmMaterial[] = [
  'quarter',
  'eighth',
  'sixteenth',
  'eighthTriplet',
  'quarterTriplet',
]

function isRhythmMaterial(value: unknown): value is RhythmMaterial {
  return typeof value === 'string' && RHYTHM_MATERIALS.includes(value as RhythmMaterial)
}

function migrateGeneration(value: unknown): GenerationSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_GENERATION_SETTINGS
  const stored = value as Record<string, unknown>
  const selectedMaterials = Array.isArray(stored.selectedMaterials)
    ? stored.selectedMaterials.filter(isRhythmMaterial)
    : DEFAULT_GENERATION_SETTINGS.selectedMaterials
  return {
    measureCount: typeof stored.measureCount === 'number'
      ? stored.measureCount
      : DEFAULT_GENERATION_SETTINGS.measureCount,
    selectedMaterials: selectedMaterials.length > 0
      ? selectedMaterials
      : DEFAULT_GENERATION_SETTINGS.selectedMaterials,
  }
}

export function loadState(): PersistedState | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return undefined
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (!parsed.playback || !parsed.exercise) return undefined
    return {
      generation: migrateGeneration(parsed.generation),
      playback: parsed.playback as PlaybackSettings,
      exercise: parsed.exercise as RhythmExercise,
    }
  } catch {
    return undefined
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
