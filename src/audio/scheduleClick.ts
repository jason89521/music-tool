export function scheduleClick(context: AudioContext, when: number, accented: boolean, volume: number): OscillatorNode {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = accented ? 1320 : 880
  gain.gain.setValueAtTime(volume * 0.25, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(when)
  oscillator.stop(when + 0.05)
  return oscillator
}
