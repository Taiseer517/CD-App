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

type Ambience = 'off' | 'on'

interface Nodes {
  ctx: AudioContext
  master: GainNode
  ambienceBus: GainNode
  effectsBus: GainNode
  running: boolean
  stopAmbience?: () => void
}

let nodes: Nodes | null = null

/** Room tone sits well under the interaction sounds so it never masks them. */
const AMBIENCE_LEVEL = 0.16
const EFFECTS_LEVEL = 0.5

function ensure(): Nodes | null {
  if (nodes) return nodes

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  const ambienceBus = ctx.createGain()
  ambienceBus.gain.value = 0
  ambienceBus.connect(master)

  const effectsBus = ctx.createGain()
  effectsBus.gain.value = EFFECTS_LEVEL
  effectsBus.connect(master)

  nodes = { ctx, master, ambienceBus, effectsBus, running: false }
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
 * The room: two drones a fifth apart, detuned just enough to beat slowly
 * against each other, over filtered noise. The beating is what stops it
 * sounding like a held synth chord.
 */
function startAmbience(n: Nodes): () => void {
  const { ctx } = n
  const voices: OscillatorNode[] = []

  const bed = ctx.createGain()
  bed.gain.value = 1
  bed.connect(n.ambienceBus)

  const shape = ctx.createBiquadFilter()
  shape.type = 'lowpass'
  shape.frequency.value = 420
  shape.Q.value = 0.6
  shape.connect(bed)

  for (const [frequency, level] of [
    [55, 0.5],
    [55.35, 0.4],
    [82.5, 0.26],
    [110.4, 0.14],
  ]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequency
    const gain = ctx.createGain()
    gain.gain.value = level
    osc.connect(gain).connect(shape)
    osc.start()
    voices.push(osc)
  }

  // Air: very quiet noise, so the silence between drones is not digital.
  const airFrames = ctx.sampleRate * 4
  const airBuffer = ctx.createBuffer(1, airFrames, ctx.sampleRate)
  const airData = airBuffer.getChannelData(0)
  for (let i = 0; i < airFrames; i++) airData[i] = (Math.random() * 2 - 1) * 0.06
  const air = ctx.createBufferSource()
  air.buffer = airBuffer
  air.loop = true
  const airFilter = ctx.createBiquadFilter()
  airFilter.type = 'bandpass'
  airFilter.frequency.value = 700
  airFilter.Q.value = 0.4
  const airGain = ctx.createGain()
  airGain.gain.value = 0.5
  air.connect(airFilter).connect(airGain).connect(bed)
  air.start()

  // A distant bell, rarely, so the room has a history rather than a texture.
  const bell = window.setInterval(
    () => {
      if (Math.random() > 0.45) return
      const base = 196 * (Math.random() > 0.5 ? 1 : 1.5)
      ;[1, 2.76, 5.4].forEach((partial, index) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = base * partial
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, ctx.currentTime)
        env.gain.exponentialRampToValueAtTime(0.05 / (index + 1), ctx.currentTime + 0.02)
        env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 5 + index)
        osc.connect(env).connect(n.ambienceBus)
        osc.start()
        osc.stop(ctx.currentTime + 6 + index)
      })
    },
    21000,
  )

  return () => {
    window.clearInterval(bell)
    voices.forEach((osc) => {
      try {
        osc.stop()
      } catch {
        // Already stopped; nothing to do.
      }
    })
    try {
      air.stop()
    } catch {
      // As above.
    }
  }
}

export const archiveAudio = {
  /** Must be called from a user gesture; browsers block audio otherwise. */
  async setAmbience(state: Ambience) {
    const n = ensure()
    if (!n) return

    if (n.ctx.state === 'suspended') await n.ctx.resume()

    if (state === 'on' && !n.running) {
      n.stopAmbience = startAmbience(n)
      n.running = true
      // Fade in: an ambience that arrives at full level announces itself.
      n.ambienceBus.gain.cancelScheduledValues(n.ctx.currentTime)
      n.ambienceBus.gain.setValueAtTime(0.0001, n.ctx.currentTime)
      n.ambienceBus.gain.exponentialRampToValueAtTime(AMBIENCE_LEVEL, n.ctx.currentTime + 3.5)
    }

    if (state === 'off' && n.running) {
      n.ambienceBus.gain.cancelScheduledValues(n.ctx.currentTime)
      n.ambienceBus.gain.setValueAtTime(n.ambienceBus.gain.value, n.ctx.currentTime)
      n.ambienceBus.gain.exponentialRampToValueAtTime(0.0001, n.ctx.currentTime + 1.2)
      const stop = n.stopAmbience
      window.setTimeout(() => stop?.(), 1400)
      n.running = false
    }
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
}
