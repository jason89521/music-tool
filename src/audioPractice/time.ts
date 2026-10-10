export function parseTime(value: string): number | undefined {
  const trimmed = value.trim()
  if (/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isFinite(seconds) ? seconds : undefined
  }
  const match = /^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/.exec(trimmed)
  if (!match) return undefined
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds >= 60) return undefined
  return minutes * 60 + seconds + Number(`0.${match[3] ?? '0'}`)
}

export function isValidInterval(start: number, end: number, duration: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end)
    && start >= 0 && start < end && end <= duration
}

export function formatTime(seconds: number): string {
  const centiseconds = Math.floor(Math.max(0, seconds) * 100 + 0.5)
  const minutes = Math.floor(centiseconds / 6000)
  const remaining = (centiseconds % 6000) / 100
  return `${String(minutes).padStart(2, '0')}:${remaining.toFixed(2).padStart(5, '0')}`
}
