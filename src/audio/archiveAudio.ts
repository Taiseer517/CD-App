/**
 * Everything the archive sounds like, synthesised.
 *
 * No files: shipping music means licensing it, and a loop short enough to
 * download is short enough to hear repeating. Oscillators and a noise buffer
 * cost a few kilobytes, never repeat, and can be shaped to the room.
 *
 * Browsers refuse to start audio without a gesture, so nothing here runs
 * until she asks for it. The context is created on that first request and
 * kept, because creating one per sound exhausts the browser's limit.
 */

interface Nodes {
  ctx: AudioContext
  master: GainNode
  effectsBus: GainNode
  /** Whether sound is armed. Every effect below is silent until it is. */
  running: boolean
}

let nodes: Nodes | null = null

const EFFECTS_LEVEL = 0.5

function ensure(): Nodes | null {
  if (nodes) return nodes

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  const effectsBus = ctx.createGain()
  effectsBus.gain.value = EFFECTS_LEVEL
  effectsBus.connect(master)

  nodes = { ctx, master, effectsBus, running: false }
  return nodes
}

/** A short burst of filtered noise — the basis of every physical sound here. */
function noiseBurst(
  n: Nodes,
  { duration, frequency, q = 1, gain = 1, type = 'bandpass' as BiquadFilterType, sweepTo }: {
    duration: number
    frequency: number
    q?: number
    gain?: number
    type?: BiquadFilterType
    sweepTo?: number
  },
) {
  const { ctx } = n
  const frames = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // Decaying noise: the envelope is in the buffer so short sounds do not
    // need a separate gain ramp to avoid clicking.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(frequency, ctx.currentTime)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration)
  filter.Q.value = q

  const level = ctx.createGain()
  level.gain.value = gain

  source.connect(filter).connect(level).connect(n.effectsBus)
  source.start()
  source.stop(ctx.currentTime + duration)
}

function tone(
  n: Nodes,
  { frequency, duration, gain = 0.3, type = 'sine' as OscillatorType, glideTo }: {
    frequency: number
    duration: number
    gain?: number
    type?: OscillatorType
    glideTo?: number
  },
) {
  const { ctx } = n
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, ctx.currentTime)
  env.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

  osc.connect(env).connect(n.effectsBus)
  osc.start()
  osc.stop(ctx.currentTime + duration + 0.02)
}

/**
 * A bell, struck.
 *
 * Bells are inharmonic — their partials are not whole multiples of the
 * fundamental, which is exactly why a bell sounds like a bell and a sine
 * sounds like a test tone. These ratios are roughly those of a tuned church
 * bell: the hum an octave below, the prime, the minor third that gives a bell
 * its melancholy, then the fifth and the nominal.
 */
const BELL_PARTIALS: [ratio: number, level: number, decay: number][] = [
  [0.5, 0.28, 1],
  [1, 1, 0.9],
  [1.19, 0.5, 0.62],
  [1.5, 0.32, 0.5],
  [2, 0.36, 0.42],
  [2.5, 0.16, 0.3],
  [3.42, 0.1, 0.22],
  [4.5, 0.06, 0.16],
]

function strike(n: Nodes, frequency: number, level: number, bus: AudioNode, decay = 5) {
  const { ctx } = n
  const now = ctx.currentTime

  for (const [ratio, partialLevel, partialDecay] of BELL_PARTIALS) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequency * ratio

    const env = ctx.createGain()
    const peak = level * partialLevel
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(peak, now + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay * partialDecay)

    osc.connect(env).connect(bus)
    osc.start(now)
    osc.stop(now + decay * partialDecay + 0.1)
  }

  // The clapper itself: a click of noise, without which a struck bell sounds
  // like it faded in rather than being hit.
  const frames = Math.floor(ctx.sampleRate * 0.03)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency * 3
  filter.Q.value = 1.2
  const clack = ctx.createGain()
  clack.gain.value = level * 0.12
  source.connect(filter).connect(clack).connect(bus)
  source.start(now)
}


export const archiveAudio = {
  /**
   * Arms the interaction sounds. Must be called from a user gesture, because
   * browsers block audio otherwise.
   *
   * There is deliberately nothing continuous to start: the archive answers
   * when touched and is silent when it is not.
   */
  async setSoundEnabled(on: boolean) {
    // Switching off something never switched on must not build the audio
    // graph. React runs effect cleanups on mount in StrictMode, and that alone
    // was enough to open an AudioContext on page load.
    if (!on && !nodes) return

    const n = ensure()
    if (!n) return

    if (on && n.ctx.state === 'suspended') await n.ctx.resume()
    n.running = on
  },

  setVolume(value: number) {
    const n = ensure()
    if (n) n.master.gain.value = Math.max(0, Math.min(1, value))
  },

  isRunning() {
    return nodes?.running ?? false
  },

  /**
   * Interaction sounds. Each is short, quiet, and modelled on the physical
   * event rather than being a beep: a case is wood and card, a disc is
   * plastic on plastic.
   */
  tip() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.06, frequency: 2400, q: 0.8, gain: 0.1, sweepTo: 900 })
  },

  pull() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.22, frequency: 1200, q: 0.5, gain: 0.14, sweepTo: 3200 })
  },

  open() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.5, frequency: 1800, q: 0.3, gain: 0.09 })
    tone(n, { frequency: 320, duration: 0.5, gain: 0.05, type: 'triangle', glideTo: 180 })
  },

  close() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.09, frequency: 420, q: 1.6, gain: 0.16 })
  },

  page() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.16, frequency: 2600, q: 0.4, gain: 0.07, sweepTo: 1200 })
  },

  /** A button pressed: a small struck bell, so the app is of a piece. */
  click() {
    const n = nodes
    if (!n?.running) return
    strike(n, 880, 0.05, n.effectsBus, 0.9)
  },

  /** Moving between pages: a fifth above, so navigation reads as going up. */
  navigate() {
    const n = nodes
    if (!n?.running) return
    strike(n, 1318.5, 0.045, n.effectsBus, 1.2)
  },

  /** A control turned on or off; the second is a tone lower. */
  toggle(on: boolean) {
    const n = nodes
    if (!n?.running) return
    strike(n, on ? 1046.5 : 784, 0.055, n.effectsBus, 1.1)
  },

  /** Something turned over — sleeve or disc. Card and plastic, not a bell. */
  flip() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.11, frequency: 2200, q: 0.5, gain: 0.09, sweepTo: 3200 })
  },

  /**
   * A record taken out of the archive: a dull thud rather than the sharp
   * click of a panel closing, so removing something never sounds incidental.
   */
  discard() {
    const n = nodes
    if (!n?.running) return
    noiseBurst(n, { duration: 0.14, frequency: 280, q: 0.6, gain: 0.18, sweepTo: 90 })
    tone(n, { frequency: 140, duration: 0.22, gain: 0.06, type: 'triangle', glideTo: 70 })
  },

  /** A record filed: two bells, rising, so the archive answers back. */
  saved() {
    const n = nodes
    if (!n?.running) return
    strike(n, 659.25, 0.06, n.effectsBus, 1)
    window.setTimeout(() => {
      if (nodes?.running) strike(nodes, 987.77, 0.07, nodes.effectsBus, 1.3)
    }, 90)
  },
}
