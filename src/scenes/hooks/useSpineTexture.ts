import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const WIDTH = 48
const HEIGHT = 400

/** Spines resident at once. A packed shelf needs one per visible case. */
const CACHE_LIMIT = 240

/**
 * The printed spine of a case, read top-to-bottom the way a real one is.
 *
 * The album's own sampled colour runs the length of the spine, which is what
 * makes a shelf of two hundred discs navigable: long before any lettering is
 * legible, the colour tells her roughly where a record lives.
 */
/** Mixes a colour toward white, so a dark sleeve still yields a legible spine. */
function lighten(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(match[1].slice(offset, offset + 2), 16)
    return Math.round(value + (255 - value) * amount)
  })
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function draw(title: string, artist: string, accent: string): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Lift the sampled colour toward the light. Cover art averages dark, and a
  // shelf of two hundred unlifted spines is a black wall.
  const base = lighten(accent || '#3a2c48', 0.34)
  const wash = ctx.createLinearGradient(0, 0, WIDTH, 0)
  wash.addColorStop(0, 'rgba(0,0,0,0.5)')
  wash.addColorStop(0.38, 'rgba(255,255,255,0.1)')
  wash.addColorStop(1, 'rgba(0,0,0,0.55)')

  ctx.fillStyle = base
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  // A curved highlight, so a packed row reads as rounded plastic cases rather
  // than a flat barcode of colour.
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, WIDTH, 14)
  ctx.fillRect(0, HEIGHT - 14, WIDTH, 14)

  ctx.save()
  ctx.translate(WIDTH / 2, HEIGHT / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Light or dark lettering, whichever survives on this album's colour.
  const rgb = /^#([0-9a-f]{6})$/i.exec(base)
  const luma = rgb
    ? (0.2126 * parseInt(rgb[1].slice(0, 2), 16) +
        0.7152 * parseInt(rgb[1].slice(2, 4), 16) +
        0.0722 * parseInt(rgb[1].slice(4, 6), 16)) / 255
    : 0.2
  const ink = luma > 0.55 ? '#14101a' : '#efe6d6'
  const quiet = luma > 0.55 ? 'rgba(20,16,26,0.72)' : 'rgba(239,230,214,0.66)'

  let size = 30
  ctx.font = `${size}px Cinzel, Georgia, serif`
  while (ctx.measureText(title).width > HEIGHT - 90 && size > 13) {
    size -= 1
    ctx.font = `${size}px Cinzel, Georgia, serif`
  }
  ctx.fillStyle = ink
  ctx.fillText(title, -22, -3)

  if (artist) {
    const artistSize = Math.max(11, size - 9)
    ctx.font = `${artistSize}px Cinzel, Georgia, serif`
    let label = artist
    while (ctx.measureText(label).width > HEIGHT - 110 && label.length > 4) {
      label = `${label.slice(0, -2)}…`
    }
    ctx.fillStyle = quiet
    ctx.fillText(label, HEIGHT / 2 - 90, -3)
  }
  ctx.restore()

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * Cached across cases. A shelf of two hundred discs would otherwise build two
 * hundred canvases on every mount, and rebuild them all on every remount.
 */
const cache = new Map<string, Texture>()

function acquire(key: string, title: string, artist: string, accent: string): Texture | null {
  const existing = cache.get(key)
  if (existing) {
    // Refresh recency: Map preserves insertion order, so re-inserting moves
    // this key to the end and keeps the oldest at the front for eviction.
    cache.delete(key)
    cache.set(key, existing)
    return existing
  }

  const created = draw(title, artist, accent)
  if (!created) return null
  cache.set(key, created)

  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.get(oldest)?.dispose()
    cache.delete(oldest)
  }

  return created
}

export function useSpineTexture(
  enabled: boolean,
  title: string,
  artist: string,
  accent: string,
): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!enabled) {
      setTexture(null)
      return
    }

    let active = true
    const ready = document.fonts?.ready ?? Promise.resolve()
    void ready.then(() => {
      if (active) setTexture(acquire(`${title}|${artist}|${accent}`, title, artist, accent))
    })

    return () => {
      active = false
    }
  }, [enabled, title, artist, accent])

  return texture
}
