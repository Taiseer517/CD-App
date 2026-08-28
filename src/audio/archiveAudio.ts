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
// Bells are sparse and quiet, so the room can sit higher than a drone could
// without becoming wallpaper.
const AMBIENCE_LEVEL = 0.34
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

/**
 * The room: a slow carillon over a very quiet drone.
 *
 * The melody wanders a natural minor scale — the mode most of this music
 * lives in, and the one that reads as old rather than merely sad. It is a
 * weighted walk rather than a random pick, so it steps more often than it
 * leaps and sounds composed rather than scattered, and it rests often,
 * because a bell that never stops is a smoke alarm.
 */
/**
 * D Dorian rather than natural minor.
 *
 * Dorian is the mode plainchant and most surviving medieval song sit in, and
 * its raised sixth is the single note that separates "old and strange" from
 * "sad" — a minor scale on its own reads as mourning, which was heavier than
 * this wants to be.
 */
const D_DORIAN = [
  146.83, 164.81, 174.61, 196, 220, 246.94, 261.63,
  293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33,
]

/** Where the melody prefers to settle: the tonic, the fifth, the octave. */
const RESTING = [0, 4, 7, 11]

function startAmbience(n: Nodes): () => void {
  const { ctx } = n
  const voices: OscillatorNode[] = []

  const reverb = ctx.createConvolver()
  // A short hall built from decaying noise: bells with no space around them
  // sound like a ringtone.
  const tail = ctx.sampleRate * 3.2
  const impulse = ctx.createBuffer(2, tail, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < tail; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / tail) ** 2.6
    }
  }
  reverb.buffer = impulse

  const wet = ctx.createGain()
  wet.gain.value = 0.55
  reverb.connect(wet).connect(n.ambienceBus)

  const bells = ctx.createGain()
  bells.gain.value = 0.5
  bells.connect(n.ambienceBus)
  bells.connect(reverb)

  // A drone well under the bells, so the room has a floor without humming.
  const bed = ctx.createGain()
  bed.gain.value = 0.13
  bed.connect(n.ambienceBus)
  const shape = ctx.createBiquadFilter()
  shape.type = 'lowpass'
  shape.frequency.value = 420
  shape.connect(bed)

  for (const [frequency, level] of [
    [73.42, 0.5],
    [73.75, 0.34],
    [110, 0.2],
    // A fifth up, very quiet: it fills the silence between strikes without
    // becoming a chord you notice.
    [220, 0.05],
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

  // Start on the tonic so the first thing heard is the key.
  let index = 7

  const play = () => {
    // Rest about a third of the time: the silences are what make it a
    // carillon drifting through a house rather than a tune being played at
    // you.
    if (Math.random() < 0.22) return

    // Mostly steps, occasionally a leap, and pulled gently back toward a
    // resting note when it has wandered — which is what makes a line sound
    // like it is going somewhere rather than drifting.
    const roll = Math.random()
    const step =
      roll < 0.62
        ? [-1, 1][Math.floor(Math.random() * 2)]
        : roll < 0.86
          ? [-2, 2][Math.floor(Math.random() * 2)]
          : [-4, 3, 4][Math.floor(Math.random() * 3)]

    index = Math.max(0, Math.min(D_DORIAN.length - 1, index + step))
    if (!RESTING.includes(index) && Math.random() < 0.3) {
      index = RESTING.reduce((best, candidate) =>
        Math.abs(candidate - index) < Math.abs(best - index) ? candidate : best,
      )
    }

    strike(n, D_DORIAN[index], 0.17, bells, 5.2)

    // A companion a third or a fifth away, struck just after — two bells
    // ringing together is the sound of a carillon rather than a doorbell.
    if (Math.random() < 0.42) {
      const interval = [2, 4, 7][Math.floor(Math.random() * 3)]
      const partner = Math.max(0, Math.min(D_DORIAN.length - 1, index + interval))
      window.setTimeout(
        () => strike(n, D_DORIAN[partner], 0.1, bells, 4.6),
        220 + Math.random() * 420,
      )
    }

    // Rarely, a small falling phrase: three notes, close together. This is
    // what turns a scattering of bells into something that sounds played.
    if (Math.random() < 0.16) {
      const start = index
      for (let note = 1; note <= 2; note++) {
        const at = Math.max(0, start - note)
        window.setTimeout(() => strike(n, D_DORIAN[at], 0.09, bells, 3.4), 520 * note)
      }
    }
  }

  // Ring once as it fades in rather than leaving several seconds of silence
  // to wonder whether the switch did anything.
  window.setTimeout(play, 900)
  const melody = window.setInterval(play, 2200)

  // The tenor bell, rarely, an octave and a half below the melody.
  const tenor = window.setInterval(() => {
    if (Math.random() < 0.5) strike(n, 110, 0.2, bells, 9)
  }, 27000)

  return () => {
    window.clearInterval(melody)
    window.clearInterval(tenor)
    voices.forEach((osc) => {
      try {
        osc.stop()
      } catch {
        // Already stopped; nothing to do.
      }
    })
  }
}

export const archiveAudio = {
  /** Must be called from a user gesture; browsers block audio otherwise. */
  async setAmbience(state: Ambience) {
    // Turning off something that was never on must not build the audio graph.
    // React runs effect cleanups on mount in StrictMode, and that alone was
    // enough to open an AudioContext on page load.
    if (state === 'off' && !nodes) return

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
}
