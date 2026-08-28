/**
 * Samples a cover down to a single colour, used to tint the light falling on
 * that item's case so each record lights its own patch of shelf.
 *
 * A flat average of every pixel returns mud — most sleeve art averages to
 * grey-brown. Instead pixels are bucketed coarsely and the most populous
 * bucket wins, with near-black and near-white dropped first so a dark gothic
 * sleeve reports its one candlelit accent rather than the darkness around it.
 */

const SAMPLE_SIZE = 48
const BUCKETS = 6

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

export async function extractDominantColor(url: string): Promise<string> {
  if (!url) return ''

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = url

  try {
    await image.decode()
  } catch {
    // A tainted or unreachable image is not worth failing an import over.
    return ''
  }

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return ''

  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

  let pixels: Uint8ClampedArray
  try {
    pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
  } catch {
    // Thrown when the canvas is tainted, i.e. the host sent no CORS header.
    return ''
  }

  const tally = new Map<number, { count: number; r: number; g: number; b: number }>()
  const step = 255 / BUCKETS

  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
    if (a < 128) continue

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (luma < 24 || luma > 232) continue

    const key =
      Math.floor(r / step) * BUCKETS * BUCKETS + Math.floor(g / step) * BUCKETS + Math.floor(b / step)
    const bucket = tally.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += r
    bucket.g += g
    bucket.b += b
    tally.set(key, bucket)
  }

  let winner: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of tally.values()) {
    if (!winner || bucket.count > winner.count) winner = bucket
  }

  // An all-black sleeve legitimately has nothing between the luma cutoffs.
  if (!winner) return ''

  return toHex(winner.r / winner.count, winner.g / winner.count, winner.b / winner.count)
}
