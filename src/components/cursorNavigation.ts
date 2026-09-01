export type ScoreCursor = {
  next: () => void
  reset: () => void
  show: () => void
  hide: () => void
}

export function moveCursorToEvent(cursor: ScoreCursor, activeEventIndex: number): void {
  cursor.reset()
  cursor.hide()
  if (activeEventIndex < 0) return
  cursor.show()
  for (let index = 0; index < activeEventIndex; index += 1) cursor.next()
}
