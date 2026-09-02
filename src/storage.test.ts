import { beforeEach, describe, expect, it } from 'vitest'
import { generateRhythm } from './domain/generateRhythm'
import { DEFAULT_PLAYBACK_SETTINGS } from './domain/rhythm'
import { loadState } from './storage'

const storageKey = 'music-tool:rhythm-practice:v1'

describe('loadState', () => {
  beforeEach(() => localStorage.clear())

  it('migrates difficulty-based settings to the default materials', () => {
    localStorage.setItem(storageKey, JSON.stringify({
      generation: { difficulty: 'hard', measureCount: 8 },
      playback: DEFAULT_PLAYBACK_SETTINGS,
      exercise: generateRhythm({ measureCount: 8, selectedMaterials: ['quarter'] }),
    }))

    expect(loadState()?.generation).toEqual({
      measureCount: 8,
      selectedMaterials: ['quarter', 'eighth', 'sixteenth'],
    })
  })

  it('keeps valid saved material selections', () => {
    localStorage.setItem(storageKey, JSON.stringify({
      generation: { measureCount: 2, selectedMaterials: ['quarterTriplet', 'unknown'] },
      playback: DEFAULT_PLAYBACK_SETTINGS,
      exercise: generateRhythm({ measureCount: 2, selectedMaterials: ['quarterTriplet'] }),
    }))

    expect(loadState()?.generation.selectedMaterials).toEqual(['quarterTriplet'])
  })
})
