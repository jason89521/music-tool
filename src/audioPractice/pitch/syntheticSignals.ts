type Signal = {
  name: string
  pcm: Float32Array
  reference: (time: number) => number
}

export function syntheticSignals(sampleRate: number): Signal[] {
  let seed = 4132
  const noise = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return 2 * seed / 2 ** 32 - 1
  }
  const sine = (phase: number) => Math.sin(phase)
  function signal(
    name: string,
    reference: Signal['reference'],
    waveform = sine,
    envelope: (time: number) => number = () => 0.43,
    noiseLevel: (time: number) => number = () => 0,
    interference: (time: number) => number = () => 0,
  ): Signal {
    let phase = 0
    const pcm = Float32Array.from({ length: sampleRate * 2 }, (_, index) => {
      const time = index / sampleRate
      const hz = reference(time)
      phase += 2 * Math.PI * hz / sampleRate
      return (hz ? envelope(time) * waveform(phase) : 0) + noiseLevel(time) * noise() + interference(time)
    })
    return { name, pcm, reference }
  }

  const lowB = () => 30.87
  const bass = (phase: number) => 0.45 * sine(phase) + 0.56 * sine(2 * phase) + 0.22 * sine(3 * phase)
  const rapid = [30.87, 55, 41.2, 73.42, 98, 41.2, 30.87, 82.41, 55, 110]
  return [
    signal('Low B', lowB),
    signal('E1', () => 41.2),
    signal('A1', () => 55),
    signal('D2', () => 73.42),
    signal('G2', () => 98),
    signal('A4', () => 440),
    signal('A5', () => 880),
    signal('Harmonic rich', lowB, bass),
    signal('Weak fundamental', lowB, (phase) => 0.035 * sine(phase) + 0.9 * sine(2 * phase) + 0.16 * sine(3 * phase)),
    signal('Missing fundamental', lowB, (phase) => 0.85 * sine(2 * phase) + 0.22 * sine(3 * phase)),
    signal('Silence', () => 0),
    signal('White noise', () => 0, sine, undefined, () => 0.3),
    signal('Vibrato', (time) => 55 * 2 ** (0.06 * sine(2 * Math.PI * 5 * time)), bass),
    signal('Slide', (time) => 30.87 * 2 ** (0.8 * time), bass),
    signal('Rapid notes', (time) => rapid[Math.floor(time / 0.08) % rapid.length], bass),
    signal('Decay', lowB, bass, (time) => 0.5 * Math.exp(-3 * time)),
    signal('Muted notes and rests', (time) => time % 0.25 < 0.075 ? 41.2 : 0, bass, (time) => 0.5 * Math.exp(-35 * (time % 0.25))),
    signal('Attack and ghost noise', (time) => time % 0.3 < 0.025 ? 0 : 41.2, bass, undefined, (time) => time % 0.3 < 0.035 ? 0.4 : 0.015),
    signal('Instrument bleed', lowB, bass, undefined, () => 0.015, (time) => 0.08 * sine(2 * Math.PI * 196.2 * time)),
  ]
}
