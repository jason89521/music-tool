import { describe, expect, it, vi } from 'vitest'
import { moveCursorToEvent } from './cursorNavigation'

describe('moveCursorToEvent', () => {
  it('keeps the cursor on the first score event when the first sound starts', () => {
    const cursor = {
      reset: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      next: vi.fn(),
    }

    moveCursorToEvent(cursor, 0)

    expect(cursor.next).not.toHaveBeenCalled()
  })

  it('advances exactly once for the second score event', () => {
    const cursor = {
      reset: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      next: vi.fn(),
    }

    moveCursorToEvent(cursor, 1)

    expect(cursor.next).toHaveBeenCalledTimes(1)
  })
})
